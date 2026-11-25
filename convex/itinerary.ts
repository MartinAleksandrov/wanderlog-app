import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { getCurrentUser, getTripRole, requireTripRole, requireUser } from './lib/permissions';

// The day-by-day plan: saved places (sights, sweet spots, restaurants) put on the trip's days,
// in order. Days are numbers (1 = the first day), so changing the trip's dates moves the plan
// with them.
// Viewers can read the plan; editors and owners change it.

const DAY_MS = 24 * 60 * 60 * 1000;

// How many days a trip has, first and last included. Its dates are 'YYYY-MM-DD'.
export function tripDayCount(trip: Pick<Doc<'trips'>, 'startDate' | 'endDate'>): number {
  const start = Date.parse(`${trip.startDate}T00:00:00Z`);
  const end = Date.parse(`${trip.endDate}T00:00:00Z`);
  return Math.round((end - start) / DAY_MS) + 1;
}

// One day's items in plan order
async function itemsOfDay(ctx: QueryCtx, tripId: Id<'trips'>, day: number) {
  return await ctx.db
    .query('itineraryItems')
    .withIndex('by_trip_and_day_and_order', (q) => q.eq('tripId', tripId).eq('day', day))
    .collect();
}

// An item the caller may change, or an error saying why not
async function requireEditableItem(ctx: MutationCtx, itemId: Id<'itineraryItems'>) {
  const user = await requireUser(ctx);
  const item = await ctx.db.get('itineraryItems', itemId);
  if (item === null) throw new ConvexError('This stop is no longer in the plan.');
  await requireTripRole(ctx, user._id, item.tripId, 'editor');
  return item;
}

// The trip's planned stops, by day and then order, each with its saved place. An empty list
// (not an error) when the caller can't see the trip. Free-text notes aren't shown yet.
export const listForTrip = query({
  args: { tripId: v.id('trips') },
  handler: async (ctx, { tripId }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return [];
    if ((await getTripRole(ctx, user._id, tripId, 'viewer')) === null) return [];

    const items = await ctx.db
      .query('itineraryItems')
      .withIndex('by_trip_and_day_and_order', (q) => q.eq('tripId', tripId))
      .collect();
    const stops = await Promise.all(
      items.map(async (item) => {
        if (item.kind !== 'place') return null;
        const place = await ctx.db.get('places', item.placeId);
        return place === null ? null : { ...item, place };
      }),
    );
    return stops.filter((stop) => stop !== null);
  },
});

// Puts a saved place at the end of a day. Already on that day: nothing changes. The same place
// may be planned on several days (a favourite cafe every morning).
export const addPlace = mutation({
  args: { tripId: v.id('trips'), day: v.number(), placeId: v.id('places') },
  handler: async (ctx, { tripId, day, placeId }) => {
    const user = await requireUser(ctx);
    await requireTripRole(ctx, user._id, tripId, 'editor');

    const trip = await ctx.db.get('trips', tripId);
    if (trip === null) throw new ConvexError('This trip no longer exists.');
    if (!Number.isInteger(day) || day < 1 || day > tripDayCount(trip)) {
      throw new ConvexError("That day isn't part of the trip.");
    }
    const place = await ctx.db.get('places', placeId);
    if (place === null || place.tripId !== tripId) {
      throw new ConvexError('This place is no longer saved to the trip.');
    }

    const dayItems = await itemsOfDay(ctx, tripId, day);
    const existing = dayItems.find((item) => item.kind === 'place' && item.placeId === placeId);
    if (existing !== undefined) return existing._id;

    const last = dayItems.at(-1);
    return await ctx.db.insert('itineraryItems', {
      tripId,
      day,
      order: (last?.order ?? 0) + 1,
      kind: 'place',
      placeId,
    });
  },
});

// Takes a stop off its day (the place stays saved to the trip)
export const removeItem = mutation({
  args: { itemId: v.id('itineraryItems') },
  handler: async (ctx, { itemId }) => {
    // Already removed, e.g. a double tap: nothing to do
    if ((await ctx.db.get('itineraryItems', itemId)) === null) return;
    await requireEditableItem(ctx, itemId);
    await ctx.db.delete('itineraryItems', itemId);
  },
});

// Moves a stop one place earlier or later in its day, by swapping it with its neighbour
export const moveItem = mutation({
  args: { itemId: v.id('itineraryItems'), direction: v.union(v.literal('up'), v.literal('down')) },
  handler: async (ctx, { itemId, direction }) => {
    const item = await requireEditableItem(ctx, itemId);
    const dayItems = await itemsOfDay(ctx, item.tripId, item.day);
    const index = dayItems.findIndex((other) => other._id === itemId);
    const neighbour = dayItems[direction === 'up' ? index - 1 : index + 1];
    // Already first or last
    if (neighbour === undefined) return;
    await ctx.db.patch('itineraryItems', item._id, { order: neighbour.order });
    await ctx.db.patch('itineraryItems', neighbour._id, { order: item.order });
  },
});

// Ticks a stop off (or back on) while out on the day
export const setDone = mutation({
  args: { itemId: v.id('itineraryItems'), done: v.boolean() },
  handler: async (ctx, { itemId, done }) => {
    const item = await requireEditableItem(ctx, itemId);
    if (item.kind !== 'place') return;
    await ctx.db.patch('itineraryItems', itemId, { done });
  },
});
