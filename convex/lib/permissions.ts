import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

// Server-side permission checks, shared by every function. The app never sends a user ID or a
// role: who is calling comes from the verified Clerk token, and what they may do comes from the
// database. Queries use the soft versions (return null), mutations the strict ones (throw).

type TripRole = Doc<'tripMembers'>['role'];

// Higher = more rights. Asking for 'editor' lets editors and owners in.
const TRIP_ROLE_RANK: Record<TripRole, number> = { viewer: 0, editor: 1, owner: 2 };

// The caller's users row, or null when signed out, or in the first moment after a first sign-in
// before the row exists. For queries, which can't create the row.
export async function getCurrentUser(ctx: QueryCtx): Promise<Doc<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) return null;
  return await ctx.db
    .query('users')
    .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', identity.subject))
    .unique();
}

// The caller's users row for mutations, created on first use. Throws when signed out.
export async function requireUser(ctx: MutationCtx): Promise<Doc<'users'>> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw new ConvexError('Please sign in again.');

  const existing = await getCurrentUser(ctx);
  if (existing !== null) return existing;

  const userId = await ctx.db.insert('users', {
    clerkUserId: identity.subject,
    email: identity.email,
    name: identity.name,
    imageUrl: identity.pictureUrl,
    // Everyone starts as a regular user; admins are promoted by hand (see schema.ts)
    role: 'user',
  });
  const user = await ctx.db.get('users', userId);
  if (user === null) throw new Error('The new user row could not be read back');
  return user;
}

// The user's role in a trip if it's at least `minRole`, otherwise null (also when the trip
// doesn't exist, so callers can't tell other people's trips apart from missing ones).
export async function getTripRole(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tripId: Id<'trips'>,
  minRole: TripRole,
): Promise<TripRole | null> {
  const membership = await ctx.db
    .query('tripMembers')
    .withIndex('by_trip_and_user', (q) => q.eq('tripId', tripId).eq('userId', userId))
    .unique();
  if (membership === null || TRIP_ROLE_RANK[membership.role] < TRIP_ROLE_RANK[minRole]) {
    return null;
  }
  return membership.role;
}

// Like getTripRole, but throws, for mutations: "you can't change this trip".
export async function requireTripRole(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tripId: Id<'trips'>,
  minRole: TripRole,
): Promise<TripRole> {
  const role = await getTripRole(ctx, userId, tripId, minRole);
  if (role === null) throw new ConvexError("This trip doesn't exist, or you can't change it.");
  return role;
}
