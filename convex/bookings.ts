import { ConvexError, v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx } from './_generated/server';
import { addDaysToDate, isCalendarDate, isClockTime } from './lib/dates';
import {
  BOOKING_NOTES_MAX_LENGTH,
  BOOKING_PRICE_MAX_CENTS,
  BOOKING_TEXT_MAX_LENGTH,
} from './lib/limits';
import { getCurrentUser, getTripRole, requireTripRole, requireUser } from './lib/permissions';
import { bookingInput, type BookingInput, type BookingType } from './schema';

// A trip's bookings: stays, flights, transport and activities (see the bookings table in
// schema.ts). Viewers can read them; editors and owners add, change and delete them.

// The trip's bookings in time order. An empty list (not an error) when the caller can't see the
// trip, e.g. right after it was deleted while on screen.
export const listForTrip = query({
  args: { tripId: v.id('trips') },
  handler: async (ctx, { tripId }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return [];
    if ((await getTripRole(ctx, user._id, tripId, 'viewer')) === null) return [];

    return await ctx.db
      .query('bookings')
      .withIndex('by_trip_and_start', (q) => q.eq('tripId', tripId))
      .collect();
  },
});

// One booking, for the edit form. null when it was deleted or isn't the caller's to see. The ID
// comes from the route's URL, so it's a plain string checked here (like trips.get).
export const get = query({
  args: { bookingId: v.string() },
  handler: async (ctx, args) => {
    const bookingId = ctx.db.normalizeId('bookings', args.bookingId);
    if (bookingId === null) return null;
    const user = await getCurrentUser(ctx);
    if (user === null) return null;
    const booking = await ctx.db.get('bookings', bookingId);
    if (booking === null) return null;
    const role = await getTripRole(ctx, user._id, booking.tripId, 'viewer');
    return role === null ? null : booking;
  },
});

// Adds a booking to a trip
export const create = mutation({
  args: { tripId: v.id('trips'), booking: bookingInput },
  handler: async (ctx, { tripId, booking }) => {
    const user = await requireUser(ctx);
    await requireTripRole(ctx, user._id, tripId, 'editor');
    return await ctx.db.insert('bookings', {
      ...validBooking(booking),
      tripId,
      addedBy: user._id,
    });
  },
});

// Replaces a booking's details (its type may change too). It stays in its trip.
export const update = mutation({
  args: { bookingId: v.id('bookings'), booking: bookingInput },
  handler: async (ctx, { bookingId, booking }) => {
    const existing = await requireEditableBooking(ctx, bookingId);
    await ctx.db.replace('bookings', bookingId, {
      ...validBooking(booking),
      tripId: existing.tripId,
      addedBy: existing.addedBy,
    });
  },
});

export const remove = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, { bookingId }) => {
    // Already deleted, e.g. a double tap: nothing to do
    if ((await ctx.db.get('bookings', bookingId)) === null) return;
    await requireEditableBooking(ctx, bookingId);
    await ctx.db.delete('bookings', bookingId);
  },
});

// A booking the caller may change, or an error saying why not
async function requireEditableBooking(ctx: MutationCtx, bookingId: Id<'bookings'>) {
  const user = await requireUser(ctx);
  const booking = await ctx.db.get('bookings', bookingId);
  if (booking === null) throw new ConvexError('This booking no longer exists.');
  await requireTripRole(ctx, user._id, booking.tripId, 'editor');
  return booking;
}

// The text each type must have, and what to tell the user when it's empty
const REQUIRED_TEXT: Record<BookingType, { field: string; message: string }[]> = {
  stay: [{ field: 'name', message: "Add where you're staying." }],
  flight: [
    { field: 'flightNumber', message: 'Add the flight number.' },
    { field: 'from', message: 'Add where the flight leaves from.' },
    { field: 'to', message: 'Add where the flight lands.' },
  ],
  transport: [{ field: 'name', message: 'Add the company, or the train, bus or ferry number.' }],
  activity: [{ field: 'name', message: 'Add what the booking is for.' }],
};

// Names for the "… can be up to 200 characters" message
const FIELD_LABELS: Record<string, string> = {
  name: 'Names',
  address: 'Addresses',
  flightNumber: 'Flight numbers',
  confirmationCode: 'Booking codes',
  notes: 'Notes',
};

// The booking as it's stored: text trimmed, empty optional text left out, and everything checked.
// The app checks the same things before saving; this guards against other callers of the API.
function validBooking(input: BookingInput): BookingInput {
  const booking = trimmedText(input);

  for (const { field, message } of REQUIRED_TEXT[booking.type]) {
    if (!(field in booking)) throw new ConvexError(message);
  }

  const dates = [booking.startDate, booking.endDate].filter((date) => date !== undefined);
  if (!dates.every(isCalendarDate)) {
    throw new ConvexError('Dates must be real days, written like 2027-05-30.');
  }
  const times = [booking.startTime, booking.endTime].filter((time) => time !== undefined);
  if (!times.every(isClockTime)) {
    throw new ConvexError('Times must be written like 09:30.');
  }
  if (booking.endTime !== undefined && booking.endDate === undefined) {
    throw new ConvexError('Add the day it ends, not only the time.');
  }
  if (!endsAfterStart(booking)) {
    throw new ConvexError(
      booking.type === 'stay'
        ? 'Check-out has to be after check-in.'
        : 'The booking has to end after it starts.',
    );
  }

  if (booking.price !== undefined) {
    const { amountCents, currency } = booking.price;
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      throw new ConvexError('The price must be zero or more.');
    }
    if (amountCents > BOOKING_PRICE_MAX_CENTS) {
      throw new ConvexError('That price is too high. Check the amount.');
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new ConvexError('Currencies are 3-letter codes, like EUR or USD.');
    }
  }
  return booking;
}

// Every text field trimmed. Optional ones left empty are dropped, and required ones too, so the
// REQUIRED_TEXT check finds them missing.
function trimmedText(input: BookingInput): BookingInput {
  const result: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(input)) {
    if (typeof value !== 'string') {
      result[field] = value;
      continue;
    }
    const text = value.trim();
    const limit = field === 'notes' ? BOOKING_NOTES_MAX_LENGTH : BOOKING_TEXT_MAX_LENGTH;
    if (text.length > limit) {
      throw new ConvexError(`${FIELD_LABELS[field] ?? 'Texts'} can be up to ${limit} characters.`);
    }
    if (text !== '') result[field] = text;
  }
  // Every field came from a checked BookingInput; only empty text was left out
  return result as BookingInput;
}

// Whether the end comes after the start. A stay's two times are on the same clock, so they
// compare directly. A journey's aren't: it leaves on one time zone's clock and arrives on
// another's. Flying west over the date line (Tokyo to Honolulu) lands at an earlier local time,
// even on the day before, so a journey may "end" up to a day before it starts.
function endsAfterStart(booking: BookingInput): boolean {
  if (booking.endDate === undefined) return true;
  if (booking.type === 'stay') {
    const start = `${booking.startDate} ${booking.startTime ?? '00:00'}`;
    const end = `${booking.endDate} ${booking.endTime ?? '23:59'}`;
    return end > start;
  }
  return booking.endDate >= addDaysToDate(booking.startDate, -1);
}
