import { ConvexError, v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query, type QueryCtx } from './_generated/server';
import { tripDayCount } from './itinerary';
import { isCalendarDate } from './lib/dates';
import { TRIP_NAME_MAX_LENGTH, TRIP_NOTES_MAX_LENGTH } from './lib/limits';
import { getCurrentUser, getTripRole, requireTripRole, requireUser } from './lib/permissions';
import { placeKindOf } from './lib/placeKind';
import { coordinates, type PlaceKind } from './schema';

// Every trip the caller is a member of, latest start date first, with their role and how many
// places to visit, sweet spots and restaurants are saved (shown on the home screen).
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
        const countOf = (kind: PlaceKind) =>
          places.filter((place) => placeKindOf(place) === kind).length;
        return {
          ...trip,
          role: membership.role,
          placeCount: countOf('sight'),
          sweetCount: countOf('sweet'),
          restaurantCount: countOf('restaurant'),
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

// One trip with the caller's role (the edit screen). null when it was deleted, or isn't theirs.
// The ID comes from a URL (/edit-trip/<ID>), so it's a plain string checked here: a malformed one
// is "not found" too, instead of an argument error that crashes the screen on every retry.
export const get = query({
  args: { tripId: v.string() },
  handler: async (ctx, args) => {
    const tripId = ctx.db.normalizeId('trips', args.tripId);
    if (tripId === null) return null;
    const user = await getCurrentUser(ctx);
    if (user === null) return null;
    const role = await getTripRole(ctx, user._id, tripId, 'viewer');
    if (role === null) return null;
    const trip = await ctx.db.get('trips', tripId);
    return trip === null ? null : { ...trip, role };
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

// The app only sends valid dates; this guards against other callers of the public API
function requireValidDates(startDate: string, endDate: string) {
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate)) {
    throw new ConvexError('Dates must be real days, written like 2027-05-30.');
  }
  if (endDate < startDate) {
    throw new ConvexError('The trip has to end on or after the day it starts.');
  }
}

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
    requireValidDates(args.startDate, args.endDate);

    const city = args.destination.split(',')[0]?.trim() || args.destination;
    // Within the limit `update` checks, or a long city name would make the trip unsaveable
    const name = `Trip to ${city}`.slice(0, TRIP_NAME_MAX_LENGTH).trim();
    const tripId = await ctx.db.insert('trips', { name, ...args });
    await ctx.db.insert('tripMembers', { tripId, userId: user._id, role: 'owner' });
    await ctx.db.patch('users', user._id, { activeTripId: tripId });
    return tripId;
  },
});

// Changes a trip's name, dates and notes. Editors and owners. Empty notes remove them.
// Plan stops keep their day numbers, so the plan moves along with a new start date. Stops on days
// past a new, earlier end move to the new last day, after the stops already planned there. A place
// is planned at most once per day (see itinerary.addPlace), so a moved stop whose place is already
// on the last day is deleted instead.
export const update = mutation({
  args: {
    tripId: v.id('trips'),
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    notes: v.string(),
  },
  handler: async (ctx, { tripId, startDate, endDate, ...text }) => {
    const user = await requireUser(ctx);
    await requireTripRole(ctx, user._id, tripId, 'editor');
    requireValidDates(startDate, endDate);
    const name = text.name.trim();
    const notes = text.notes.trim();
    if (name === '') throw new ConvexError('Give the trip a name.');
    if (name.length > TRIP_NAME_MAX_LENGTH) {
      throw new ConvexError(`Trip names can be up to ${TRIP_NAME_MAX_LENGTH} characters.`);
    }
    if (notes.length > TRIP_NOTES_MAX_LENGTH) {
      throw new ConvexError(`Trip notes can be up to ${TRIP_NOTES_MAX_LENGTH} characters.`);
    }

    // The new last day and every day after it, in plan order: one index range read
    const lastDay = tripDayCount({ startDate, endDate });
    const fromLastDay = await ctx.db
      .query('itineraryItems')
      .withIndex('by_trip_and_day_and_order', (q) => q.eq('tripId', tripId).gte('day', lastDay))
      .collect();
    const onLastDay = fromLastDay.filter((item) => item.day === lastDay);
    const plannedPlaces = new Set(
      onLastDay.flatMap((item) => (item.kind === 'place' ? [item.placeId] : [])),
    );
    let order = onLastDay.at(-1)?.order ?? 0;
    for (const item of fromLastDay.filter((item) => item.day > lastDay)) {
      if (item.kind === 'place' && plannedPlaces.has(item.placeId)) {
        await ctx.db.delete('itineraryItems', item._id);
        continue;
      }
      if (item.kind === 'place') plannedPlaces.add(item.placeId);
      order += 1;
      await ctx.db.patch('itineraryItems', item._id, { day: lastDay, order });
    }

    // undefined removes the field from the document
    await ctx.db.patch('trips', tripId, {
      name,
      startDate,
      endDate,
      notes: notes === '' ? undefined : notes,
    });
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
// trip's itinerary, places, bookings and memberships are deleted here first.
export const remove = mutation({
  args: { tripId: v.id('trips') },
  handler: async (ctx, { tripId }) => {
    const user = await requireUser(ctx);
    await requireTripRole(ctx, user._id, tripId, 'owner');

    const [items, places, bookings, members] = await Promise.all([
      ctx.db
        .query('itineraryItems')
        .withIndex('by_trip_and_day_and_order', (q) => q.eq('tripId', tripId))
        .collect(),
      ctx.db
        .query('places')
        .withIndex('by_trip', (q) => q.eq('tripId', tripId))
        .collect(),
      ctx.db
        .query('bookings')
        .withIndex('by_trip_and_start', (q) => q.eq('tripId', tripId))
        .collect(),
      ctx.db
        .query('tripMembers')
        .withIndex('by_trip_and_user', (q) => q.eq('tripId', tripId))
        .collect(),
    ]);
    await Promise.all([
      ...items.map((item) => ctx.db.delete('itineraryItems', item._id)),
      ...places.map((place) => ctx.db.delete('places', place._id)),
      ...bookings.map((booking) => ctx.db.delete('bookings', booking._id)),
      ...members.map((member) => ctx.db.delete('tripMembers', member._id)),
    ]);
    await ctx.db.delete('trips', tripId);
  },
});
