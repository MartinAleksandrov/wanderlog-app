// Text length limits, shared by the backend (which enforces them) and the app (which stops the
// user typing past them). Plain constants with no imports, so the app can bundle this file
// without pulling in any server code.

export const TRIP_NAME_MAX_LENGTH = 60;
export const TRIP_NOTES_MAX_LENGTH = 2000;
// The longest a trip can be, first and last day included. The plan draws every day (a chip and
// a heading), so a mistyped year (2036 for 2026) would otherwise make thousands of them.
export const TRIP_MAX_DAYS = 30;

// The travel journal: a longer story for the whole city, a shorter note per place
export const TRIP_JOURNAL_MAX_LENGTH = 4000;
export const PLACE_NOTES_MAX_LENGTH = 1000;
// Stars in the journal: 1 to 5
export const MAX_RATING = 5;

// Bookings: names, codes, addresses and the like; notes are longer
export const BOOKING_TEXT_MAX_LENGTH = 200;
export const BOOKING_NOTES_MAX_LENGTH = 2000;
// A hotel's website comes from Google, tracking parameters and all, and the form can't edit it:
// a short limit would make that stay impossible to save
export const BOOKING_URL_MAX_LENGTH = 2000;
// The highest price a booking can have, in cents: 1,000,000 in any currency
export const BOOKING_PRICE_MAX_CENTS = 100_000_000;

// The admin dashboard counts users, trips, places and the like by reading the rows: Convex keeps
// no running counts. It reads at most this many per table, which keeps the dashboard's one query
// well inside Convex's limit on rows read per query. At the limit the app shows "2,000+".
export const ADMIN_COUNT_LIMIT = 2000;
