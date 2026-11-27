import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx } from './_generated/server';
import { utcDateOf } from './lib/dates';
import { ADMIN_COUNT_LIMIT } from './lib/limits';
import { getAdmin, requireAdmin } from './lib/permissions';
import { googleRequestKind } from './schema';
import { deleteTripAndContents } from './trips';

// The admin dashboard's backend. Every function checks that the caller is an admin before
// anything else: the app hides the dashboard from everyone else, but the code is public, so
// anyone could call these functions directly.

const DAY_MS = 24 * 60 * 60 * 1000;
// The requests chart: today and the six days before it
const CHART_DAYS = 7;
// Phone models listed by name; the rest are added up as "Other"
const TOP_MODELS = 5;
// Every kind of Google request, read from the validator so a new kind shows up by itself
const REQUEST_KINDS = googleRequestKind.members.map((member) => member.value);

// Everything the dashboard screen shows, in one query, so the screen has one live subscription:
// it updates by itself as people use the app. null for anyone who isn't an admin.
// "Now" is when the query last ran. Convex re-runs it whenever a row it read changes (any app
// start writes a device row), not as time passes, so "active today" can lag a little on a quiet
// day; reopening the screen runs it again.
export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    if ((await getAdmin(ctx)) === null) return null;
    const now = Date.now();
    const chartDays = Array.from({ length: CHART_DAYS }, (_, index) =>
      utcDateOf(now - (CHART_DAYS - 1 - index) * DAY_MS),
    );
    const firstChartDay = utcDateOf(now - (CHART_DAYS - 1) * DAY_MS);

    const [users, devices, memberships, trips, places, bookings, requestCounts] = await Promise.all(
      [
        ctx.db.query('users').take(ADMIN_COUNT_LIMIT),
        ctx.db.query('devices').take(ADMIN_COUNT_LIMIT),
        ctx.db.query('tripMembers').take(ADMIN_COUNT_LIMIT),
        ctx.db.query('trips').take(ADMIN_COUNT_LIMIT),
        ctx.db.query('places').take(ADMIN_COUNT_LIMIT),
        ctx.db.query('bookings').take(ADMIN_COUNT_LIMIT),
        ctx.db
          .query('googleRequests')
          .withIndex('by_day', (q) => q.gte('day', firstChartDay))
          .take(ADMIN_COUNT_LIMIT),
      ],
    );

    // Each user's most recently used phone: when they were last seen, and on what
    const latestDeviceOf = new Map<Id<'users'>, Doc<'devices'>>();
    for (const device of devices) {
      const latest = latestDeviceOf.get(device.userId);
      if (latest === undefined || device.lastSeenAt > latest.lastSeenAt) {
        latestDeviceOf.set(device.userId, device);
      }
    }
    const seenWithin = (ms: number) =>
      [...latestDeviceOf.values()].filter((device) => device.lastSeenAt >= now - ms).length;

    const tripCountOf = countBy(memberships, (membership) => membership.userId);
    const requestsOf = sumBy(requestCounts, (counter) => counter.userId);
    const requestsOnDay = sumBy(requestCounts, (counter) => counter.day);
    const requestsOfKind = sumBy(requestCounts, (counter) => counter.kind);

    // People per phone model, by the phone each person used last (someone who moved from the
    // emulator to a phone counts once, for the phone), most used first
    const modelCounts = [...countBy([...latestDeviceOf.values()], deviceName)].sort(
      (a, b) => b[1] - a[1],
    );
    const otherModels = modelCounts
      .slice(TOP_MODELS)
      .reduce((total, [, count]) => total + count, 0);

    return {
      people: {
        total: users.length,
        activeToday: seenWithin(DAY_MS),
        activeThisWeek: seenWithin(7 * DAY_MS),
        activeThisMonth: seenWithin(30 * DAY_MS),
        newThisWeek: users.filter((user) => user._creationTime >= now - 7 * DAY_MS).length,
        suspended: users.filter((user) => user.suspendedAt !== undefined).length,
      },
      content: { trips: trips.length, places: places.length, bookings: bookings.length },
      requests: {
        byDay: chartDays.map((day) => ({ day, count: requestsOnDay.get(day) ?? 0 })),
        byKind: REQUEST_KINDS.map((kind) => ({ kind, count: requestsOfKind.get(kind) ?? 0 })).sort(
          (a, b) => b.count - a.count,
        ),
      },
      models: [
        ...modelCounts.slice(0, TOP_MODELS).map(([name, count]) => ({ name, count })),
        ...(otherModels > 0 ? [{ name: 'Other', count: otherModels }] : []),
      ],
      // Most recently seen first; people never seen (signed up before devices were noted) last
      users: users
        .map((user) => {
          const device = latestDeviceOf.get(user._id);
          return {
            _id: user._id,
            name: user.name,
            email: user.email,
            imageUrl: user.imageUrl,
            role: user.role,
            suspended: user.suspendedAt !== undefined,
            joinedAt: user._creationTime,
            lastSeenAt: device?.lastSeenAt,
            device: device === undefined ? undefined : deviceName(device),
            tripCount: tripCountOf.get(user._id) ?? 0,
            requestsThisWeek: requestsOf.get(user._id) ?? 0,
          };
        })
        .sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0)),
    };
  },
});

// One user's page on the dashboard: their account, phones, trips and Google requests. null for
// anyone who isn't an admin, and for a user who doesn't exist. The ID comes from a URL
// (/admin/user/<ID>), so it's a plain string checked here, like trips.get.
export const user = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const admin = await getAdmin(ctx);
    if (admin === null) return null;
    const userId = ctx.db.normalizeId('users', args.userId);
    const user = userId === null ? null : await ctx.db.get('users', userId);
    if (user === null) return null;

    const now = Date.now();
    const today = utcDateOf(now);
    const weekStart = utcDateOf(now - 6 * DAY_MS);

    // One user's rows: a few phones, their trips, and one counter per day and kind of request
    const [devices, memberships, requestCounts] = await Promise.all([
      ctx.db
        .query('devices')
        .withIndex('by_user_and_platform_and_model', (q) => q.eq('userId', user._id))
        .collect(),
      ctx.db
        .query('tripMembers')
        .withIndex('by_user', (q) => q.eq('userId', user._id))
        .collect(),
      ctx.db
        .query('googleRequests')
        .withIndex('by_user_and_day_and_kind', (q) => q.eq('userId', user._id))
        .collect(),
    ]);

    const trips = await Promise.all(
      memberships.map(async (membership) => {
        const trip = await ctx.db.get('trips', membership.tripId);
        if (trip === null) return null;
        const [places, bookings] = await Promise.all([
          ctx.db
            .query('places')
            .withIndex('by_trip', (q) => q.eq('tripId', trip._id))
            .take(ADMIN_COUNT_LIMIT),
          ctx.db
            .query('bookings')
            .withIndex('by_trip_and_start', (q) => q.eq('tripId', trip._id))
            .take(ADMIN_COUNT_LIMIT),
        ]);
        return {
          _id: trip._id,
          name: trip.name,
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate,
          role: membership.role,
          placeCount: places.length,
          bookingCount: bookings.length,
        };
      }),
    );

    // Per kind: today, the last 7 days (today included, as on the dashboard's chart), and since
    // counting began. Days are 'YYYY-MM-DD', so comparing them as text compares them as dates.
    const requests = REQUEST_KINDS.map((kind) => {
      const counters = requestCounts.filter((counter) => counter.kind === kind);
      const total = (from: string) =>
        counters
          .filter((counter) => counter.day >= from)
          .reduce((sum, counter) => sum + counter.count, 0);
      return { kind, today: total(today), thisWeek: total(weekStart), allTime: total('') };
    });

    const sortedDevices = devices.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      imageUrl: user.imageUrl,
      role: user.role,
      // To find the same person in the Clerk dashboard
      clerkUserId: user.clerkUserId,
      joinedAt: user._creationTime,
      suspendedAt: user.suspendedAt,
      dataDeletedAt: user.dataDeletedAt,
      // The screen hides Suspend and Delete for the admin's own row (the mutations refuse it too)
      isYou: user._id === admin._id,
      lastSeenAt: sortedDevices[0]?.lastSeenAt,
      devices: sortedDevices.map((device) => ({
        _id: device._id,
        name: deviceName(device),
        osVersion: device.osVersion,
        appVersion: device.appVersion,
        lastSeenAt: device.lastSeenAt,
      })),
      trips: trips
        .filter((trip) => trip !== null)
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
      requests,
    };
  },
});

// "Samsung SM-S921B": Android reports the maker in lower case ('samsung')
function deviceName(device: Doc<'devices'>): string {
  const maker = device.manufacturer ?? '';
  return `${maker.charAt(0).toUpperCase()}${maker.slice(1)} ${device.model}`.trim();
}

function countBy<T, K>(rows: T[], keyOf: (row: T) => K): Map<K, number> {
  const counts = new Map<K, number>();
  for (const row of rows) counts.set(keyOf(row), (counts.get(keyOf(row)) ?? 0) + 1);
  return counts;
}

// Adds up request counters by a key (user, day or kind)
function sumBy<K>(
  counters: Doc<'googleRequests'>[],
  keyOf: (counter: Doc<'googleRequests'>) => K,
): Map<K, number> {
  const sums = new Map<K, number>();
  for (const counter of counters) {
    sums.set(keyOf(counter), (sums.get(keyOf(counter)) ?? 0) + counter.count);
  }
  return sums;
}

// Blocks a user from the app. Their data stays, and restoreUser undoes it. From the next moment
// every function treats them as signed out (see convex/lib/permissions.ts) and the app shows
// "Your account was suspended". The Clerk account is left alone on purpose: deleted, the same
// email could sign up again, get a new Clerk ID and a fresh, unsuspended users row.
export const suspendUser = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const target = await requireSuspendable(ctx, userId);
    if (target.suspendedAt === undefined) {
      await ctx.db.patch('users', userId, { suspendedAt: Date.now() });
    }
  },
});

// Lets a suspended user back in. After "Delete data" they start again with no trips.
export const restoreUser = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    // Removed in the Convex dashboard meanwhile: a message for the admin, not a crash
    if ((await ctx.db.get('users', userId)) === null) {
      throw new ConvexError('This user no longer exists.');
    }
    // undefined removes the field
    await ctx.db.patch('users', userId, { suspendedAt: undefined });
  },
});

// Suspends a user and deletes their data for good: the trips they own (with everything in them),
// their memberships in other people's trips, their devices and their request counts. What stays
// is the suspended users row, with name and email, so the dashboard still shows who it is.
// Places and bookings they added to someone else's trip stay too: they belong to that trip.
// One mutation, so it happens all at once or not at all (a single user's data is well within
// Convex's limit of writes per mutation).
export const deleteUserData = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const target = await requireSuspendable(ctx, userId);

    const memberships = await ctx.db
      .query('tripMembers')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    for (const membership of memberships) {
      const trip = await ctx.db.get('trips', membership.tripId);
      if (trip !== null && membership.role === 'owner') {
        await deleteTripAndContents(ctx, trip._id);
      } else {
        await ctx.db.delete('tripMembers', membership._id);
      }
    }

    const [devices, requestCounts] = await Promise.all([
      ctx.db
        .query('devices')
        .withIndex('by_user_and_platform_and_model', (q) => q.eq('userId', userId))
        .collect(),
      ctx.db
        .query('googleRequests')
        .withIndex('by_user_and_day_and_kind', (q) => q.eq('userId', userId))
        .collect(),
    ]);
    await Promise.all([
      ...devices.map((device) => ctx.db.delete('devices', device._id)),
      ...requestCounts.map((counter) => ctx.db.delete('googleRequests', counter._id)),
    ]);

    const now = Date.now();
    await ctx.db.patch('users', userId, {
      suspendedAt: target.suspendedAt ?? now,
      dataDeletedAt: now,
      activeTripId: undefined,
    });
  },
});

// The user an admin is about to suspend. Not the admin themselves (they would lock themselves
// out), and not another admin (two admins could lock each other out): an admin is made a user
// in the Convex dashboard first.
async function requireSuspendable(ctx: MutationCtx, userId: Id<'users'>): Promise<Doc<'users'>> {
  const admin = await requireAdmin(ctx);
  const target = await ctx.db.get('users', userId);
  if (target === null) throw new ConvexError('This user no longer exists.');
  if (target._id === admin._id) throw new ConvexError("You can't suspend your own account.");
  if (target.role === 'admin') {
    throw new ConvexError(
      "Admins can't be suspended. Make them a user in the Convex dashboard first.",
    );
  }
  return target;
}
