import { ConvexError, v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { mutation, query, type QueryCtx } from './_generated/server';
import { MAX_RATING, PLACE_NOTES_MAX_LENGTH, TRIP_JOURNAL_MAX_LENGTH } from './lib/limits';
import { getCurrentUser, getTripRole, requireTripRole, requireUser } from './lib/permissions';
import { placeKindOf } from './lib/placeKind';

// The travel journal: after a trip, a story and stars for the whole city, and a note and stars
// for each place saved to it.

// How many place photos a past trip's card shows
const CARD_PHOTOS = 5;

// The places the user ticked off on a plan day ("been there")
async function visitedPlaceIds(ctx: QueryCtx, tripId: Id<'trips'>): Promise<Set<Id<'places'>>> {
  const items = await ctx.db
    .query('itineraryItems')
    .withIndex('by_trip_and_day_and_order', (q) => q.eq('tripId', tripId))
    .collect();
  return new Set(
    items.flatMap((item) => (item.kind === 'place' && item.done === true ? [item.placeId] : [])),
  );
}

// The account tab's past trips (newest first), for the globe and the trip cards: each trip with
// how many places were saved to it and the photos of a few of them, the ticked-off ones first.
// `today` is the phone's date: only the phone knows what day it is where the user is, so the app
// sends it (a trip is past once its last day is over, as on the home screen).
export const pastTrips = query({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return [];

    const memberships = await ctx.db
      .query('tripMembers')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();
    const trips = await Promise.all(
      memberships.map(async (membership) => {
        const trip = await ctx.db.get('trips', membership.tripId);
        if (trip === null || trip.endDate >= today) return null;
        const [places, visited] = await Promise.all([
          ctx.db
            .query('places')
            .withIndex('by_trip', (q) => q.eq('tripId', trip._id))
            .collect(),
          visitedPlaceIds(ctx, trip._id),
        ]);
        // sort() keeps the saved order among equals, so the rest stay oldest first
        const photos = places
          .flatMap((place) =>
            place.photoName === undefined
              ? []
              : [{ _id: place._id, name: place.name, photoName: place.photoName }],
          )
          .sort((a, b) => Number(visited.has(b._id)) - Number(visited.has(a._id)))
          .slice(0, CARD_PHOTOS);
        // The role: only editors and owners get the nudge to write about the trip
        return { ...trip, role: membership.role, placeCount: places.length, photos };
      }),
    );
    return trips
      .filter((trip) => trip !== null)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  },
});

// One trip's journal page: the trip with the caller's role, and its saved places. A place the
// user ticked off on a plan day ("been there") is `visited`. null when the trip was deleted, or
// isn't theirs. The ID comes from a URL (/journal/<ID>), so it's checked here, like trips.get.
export const forTrip = query({
  args: { tripId: v.string() },
  handler: async (ctx, args) => {
    const tripId = ctx.db.normalizeId('trips', args.tripId);
    if (tripId === null) return null;
    const user = await getCurrentUser(ctx);
    if (user === null) return null;
    const role = await getTripRole(ctx, user._id, tripId, 'viewer');
    if (role === null) return null;
    const trip = await ctx.db.get('trips', tripId);
    if (trip === null) return null;

    const [places, visited] = await Promise.all([
      ctx.db
        .query('places')
        .withIndex('by_trip', (q) => q.eq('tripId', tripId))
        .collect(),
      visitedPlaceIds(ctx, tripId),
    ]);

    return {
      trip: { ...trip, role },
      // Oldest first (the order they were saved in), with the list each one is on
      places: places.map((place) => ({
        ...place,
        kind: placeKindOf(place),
        visited: visited.has(place._id),
      })),
    };
  },
});

// Stars sent by the app: a whole number from 1 to 5, or null to take them away
const ratingArg = v.union(v.number(), v.null());

function checkRating(rating: number | null | undefined) {
  if (rating === null || rating === undefined) return;
  if (!Number.isInteger(rating) || rating < 1 || rating > MAX_RATING) {
    throw new ConvexError(`Ratings are 1 to ${MAX_RATING} stars.`);
  }
}

// The text to store: trimmed, and undefined (the field is removed) when it's empty
function cleanText(text: string, maxLength: number, what: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed.length > maxLength) {
    throw new ConvexError(`${what} can be up to ${maxLength} characters.`);
  }
  return trimmed === '' ? undefined : trimmed;
}

// Saves the trip's journal story, its stars, or both. Editors and owners. Each is optional, so
// the note (saved as the user types) and the stars (saved on a tap) can't overwrite each other.
export const saveTrip = mutation({
  args: {
    tripId: v.id('trips'),
    journal: v.optional(v.string()),
    rating: v.optional(ratingArg),
  },
  handler: async (ctx, { tripId, journal, rating }) => {
    const user = await requireUser(ctx);
    await requireTripRole(ctx, user._id, tripId, 'editor');
    checkRating(rating);

    await ctx.db.patch('trips', tripId, {
      ...(journal !== undefined && {
        journal: cleanText(journal, TRIP_JOURNAL_MAX_LENGTH, 'The journal'),
      }),
      ...(rating !== undefined && { rating: rating ?? undefined }),
    });
  },
});

// Saves a place's journal note, its stars, or both. Editors and owners of the place's trip.
export const savePlace = mutation({
  args: {
    placeId: v.id('places'),
    notes: v.optional(v.string()),
    rating: v.optional(ratingArg),
  },
  handler: async (ctx, { placeId, notes, rating }) => {
    const user = await requireUser(ctx);
    const place = await ctx.db.get('places', placeId);
    // Removed meanwhile (on another phone): the note has nowhere to go
    if (place === null) throw new ConvexError('This place was removed from the trip.');
    await requireTripRole(ctx, user._id, place.tripId, 'editor');
    checkRating(rating);

    await ctx.db.patch('places', placeId, {
      ...(notes !== undefined && {
        notes: cleanText(notes, PLACE_NOTES_MAX_LENGTH, 'Place notes'),
      }),
      ...(rating !== undefined && { rating: rating ?? undefined }),
    });
  },
});
