import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx } from './_generated/server';
import { getUserRow, profileFromIdentity, requireUser } from './lib/permissions';
import { deviceInfo, type DeviceInfo } from './schema';

// Longest device text kept. The app sends short values ('SM-S921B'); anything longer came from
// another caller of the public API.
const DEVICE_TEXT_MAX_LENGTH = 100;

// Creates the signed-in person's users row and notes the phone they're on. The app calls it
// right after sign-in and whenever it comes back to the foreground, so queries find the row from
// the start and the dashboard knows who used the app when. Safe to call again: it returns the
// existing row's ID. `device` is optional so app builds from before it existed keep working.
// A suspended account gets null and nothing is written: the app learns about it from `me`.
export const store = mutation({
  args: { device: v.optional(deviceInfo) },
  handler: async (ctx, { device }) => {
    const existing = await getUserRow(ctx);
    if (existing?.suspendedAt !== undefined) return null;

    const user = await requireUser(ctx);
    await refreshProfile(ctx, user);
    if (device !== undefined) await recordDevice(ctx, user._id, device);
    return user._id;
  },
});

// Copies email, name and photo from the sign-in token to the row, so a row made before the token
// carried them (or before a name change) is filled in on the next start. Written only when
// something changed: every query reads this row, and a write re-runs them all. A claim missing
// from the token keeps what the row has rather than erasing it.
async function refreshProfile(ctx: MutationCtx, user: Doc<'users'>) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) return;
  const profile = profileFromIdentity(identity);
  const next = {
    email: profile.email ?? user.email,
    name: profile.name ?? user.name,
    imageUrl: profile.imageUrl ?? user.imageUrl,
  };
  if (next.email !== user.email || next.name !== user.name || next.imageUrl !== user.imageUrl) {
    await ctx.db.patch('users', user._id, next);
  }
}

// The phone's row, created on its first start and updated on every one after
async function recordDevice(ctx: MutationCtx, userId: Id<'users'>, device: DeviceInfo) {
  const clean = (text: string) => text.trim().slice(0, DEVICE_TEXT_MAX_LENGTH);
  const fields = {
    platform: clean(device.platform),
    model: clean(device.model),
    manufacturer: device.manufacturer === undefined ? undefined : clean(device.manufacturer),
    osVersion: clean(device.osVersion),
    appVersion: device.appVersion === undefined ? undefined : clean(device.appVersion),
    lastSeenAt: Date.now(),
  };

  const existing = await ctx.db
    .query('devices')
    .withIndex('by_user_and_platform_and_model', (q) =>
      q.eq('userId', userId).eq('platform', fields.platform).eq('model', fields.model),
    )
    .unique();
  if (existing === null) {
    await ctx.db.insert('devices', { userId, ...fields });
  } else {
    await ctx.db.patch('devices', existing._id, fields);
  }
}

// The account screen's data from our backend: the app role and how many trips the user is in.
// Name, email and photo come from Clerk on the device, which always has the latest values.
// `suspended` makes the app swap everything for the "Your account was suspended" screen; it's
// live, so it happens the moment an admin suspends the account.
// null while signed out or before `store` has run.
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUserRow(ctx);
    if (user === null) return null;

    const memberships = await ctx.db
      .query('tripMembers')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();
    return {
      role: user.role,
      tripCount: memberships.length,
      suspended: user.suspendedAt !== undefined,
    };
  },
});
