import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getCurrentUser, getTripRole, requireTripRole, requireUser } from './lib/permissions';
import { placeKindOf } from './lib/placeKind';
import { coordinates, placeKind } from './schema';

// The places saved to a trip, both lists, newest first: the saved pins on the map (each list
// shows its own, by `kind`). An empty list (not an error) when the caller can't see the trip,
// e.g. right after it was deleted while on screen.
export const listForTrip = query({
  args: { tripId: v.id('trips') },
  handler: async (ctx, { tripId }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return [];
    if ((await getTripRole(ctx, user._id, tripId, 'viewer')) === null) return [];

    return await ctx.db
      .query('places')
      .withIndex('by_trip', (q) => q.eq('tripId', tripId))
      .order('desc')
      .collect();
  },
});

// Saves a suggested place to one of a trip's lists (places to visit, sweet spots or
// restaurants). Editors and owners only. Saving the same Google place to the same list twice
// returns the existing row instead of adding a duplicate pin; a place may be on several lists.
export const add = mutation({
  args: {
    tripId: v.id('trips'),
    kind: placeKind,
    place: v.object({
      providerPlaceId: v.string(),
      name: v.string(),
      coordinates,
      address: v.optional(v.string()),
      photoName: v.optional(v.string()),
      category: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { tripId, kind, place }) => {
    const user = await requireUser(ctx);
    await requireTripRole(ctx, user._id, tripId, 'editor');

    // A trip has tens of places, so reading them all is cheaper than another index
    const saved = await ctx.db
      .query('places')
      .withIndex('by_trip', (q) => q.eq('tripId', tripId))
      .collect();
    const existing = saved.find(
      (p) => p.providerPlaceId === place.providerPlaceId && placeKindOf(p) === kind,
    );
    if (existing !== undefined) return existing._id;

    return await ctx.db.insert('places', { tripId, addedBy: user._id, kind, ...place });
  },
});

// Removes a place from its trip, and from the itinerary days it was planned on
export const remove = mutation({
  args: { placeId: v.id('places') },
  handler: async (ctx, { placeId }) => {
    const user = await requireUser(ctx);
    const place = await ctx.db.get('places', placeId);
    // Already removed, e.g. a double tap: nothing to do
    if (place === null) return;
    await requireTripRole(ctx, user._id, place.tripId, 'editor');

    const items = await ctx.db
      .query('itineraryItems')
      .withIndex('by_place', (q) => q.eq('placeId', placeId))
      .collect();
    await Promise.all(items.map((item) => ctx.db.delete('itineraryItems', item._id)));
    await ctx.db.delete('places', placeId);
  },
});
