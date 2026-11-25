// Text length limits, shared by the backend (which enforces them) and the app (which stops the
// user typing past them). Plain constants with no imports, so the app can bundle this file
// without pulling in any server code.

export const TRIP_NAME_MAX_LENGTH = 60;
export const TRIP_NOTES_MAX_LENGTH = 2000;

// Bookings: names, codes, addresses and the like; notes are longer
export const BOOKING_TEXT_MAX_LENGTH = 200;
export const BOOKING_NOTES_MAX_LENGTH = 2000;
// The highest price a booking can have, in cents: 1,000,000 in any currency
export const BOOKING_PRICE_MAX_CENTS = 100_000_000;
