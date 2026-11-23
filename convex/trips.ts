import { ConvexError, v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query, type QueryCtx } from './_generated/server';
import { getCurrentUser, getTripRole, requireTripRole, requireUser } from './lib/permissions';
import { placeKindOf } from './places';
import { coordinates } from './schema';

// Every trip the caller is a member of, latest start date first, with their role and how many
// places to visit and sweet spots are saved (shown on the home screen).
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return [];

    const memberships = await ctx.db
      .query('tripMembers')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();
    const trips = await Promise.all(
      memberships.map(async (membership) => {
        const trip = await ctx.db.get('trips', membership.tripId);
        if (trip === null) return null;
        const places = await ctx.db
          .query('places')
          .withIndex('by_trip', (q) => q.eq('tripId', trip._id))
          .collect();
        const sweetCount = places.filter((place) => placeKindOf(place) === 'sweet').length;
        return {
          ...trip,
          role: membership.role,
          placeCount: places.length - sweetCount,
          sweetCount,
        };
      }),
    );
    return trips
      .filter((trip) => trip !== null)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  },
});

// The trip the map and places tabs show, with the caller's role. null when they have no trips.
export const active = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return null;
    return await findActiveTrip(ctx, user);
  },
});

// The trip the user picked last; if none, or it was deleted, their newest trip
async function findActiveTrip(ctx: QueryCtx, user: Doc<'users'>) {
  if (user.activeTripId !== undefined) {
    const role = await getTripRole(ctx, user._id, user.activeTripId, 'viewer');
    const trip = role === null ? null : await ctx.db.get('trips', user.activeTripId);
    if (role !== null && trip !== null) return { ...trip, role };
  }

  const newest = await ctx.db
    .query('tripMembers')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .order('desc')
    .first();
  if (newest === null) return null;
  const trip = await ctx.db.get('trips', newest.tripId);
  return trip === null ? null : { ...trip, role: newest.role };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Creates a trip with the caller as its owner, and makes it the active trip
export const create = mutation({
  args: {
    // e.g. "Lisbon, Portugal"
    destination: v.string(),
    destinationCoordinates: coordinates,
    destinationPhotoName: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    // The app only sends valid dates; this guards against other callers of the public API
    if (!ISO_DATE.test(args.startDate) || !ISO_DATE.test(args.endDate)) {
      throw new ConvexError('Dates must look like 2027-05-30.');
    }
    if (args.endDate < args.startDate) {
      throw new ConvexError('The trip has to end on or after the day it starts.');
    }

    const city = args.destination.split(',')[0]?.trim() || args.destination;
    const tripId = await ctx.db.insert('trips', { name: `Trip to ${city}`, ...args });
    await ctx.db.insert('tripMembers', { tripId, userId: user._id, role: 'owner' });
    await ctx.db.patch('users', user._id, { activeTripId: tripId });
    return tripId;
  },
});

// Makes one of the caller's trips the one the map and places tabs show
export const setActive = mutation({
  args: { tripId: v.id('trips') },
  handler: async (ctx, { tripId }) => {
    const user = await requireUser(ctx);
    await requireTripRole(ctx, user._id, tripId, 'viewer');
    await ctx.db.patch('users', user._id, { activeTripId: tripId });
  },
});

// Deletes a trip and everything in it. Owners only. Convex has no cascading deletes, so the
// trip's itinerary, places and memberships are deleted here first.
export const remove = mutation({
  args: { tripId: v.id('trips') },
  handler: async (ctx, { tripId }) => {
    const user = await requireUser(ctx);
    await requireTripRole(ctx, user._id, tripId, 'owner');

    const [items, places, members] = await Promise.all([
      ctx.db
        .query('itineraryItems')
        .withIndex('by_trip_and_day_and_order', (q) => q.eq('tripId', tripId))
        .collect(),
      ctx.db
        .query('places')
        .withIndex('by_trip', (q) => q.eq('tripId', tripId))
        .collect(),
      ctx.db
        .query('tripMembers')
        .withIndex('by_trip_and_user', (q) => q.eq('tripId', tripId))
        .collect(),
    ]);
    await Promise.all([
      ...items.map((item) => ctx.db.delete('itineraryItems', item._id)),
      ...places.map((place) => ctx.db.delete('places', place._id)),
      ...members.map((member) => ctx.db.delete('tripMembers', member._id)),
    ]);
    await ctx.db.delete('trips', tripId);
  },
});
