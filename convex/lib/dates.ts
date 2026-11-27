// Checks for the calendar dates ('YYYY-MM-DD') and clock times ('HH:mm') the app stores. Shared
// by trips and bookings: the app only sends valid ones, these guard against other callers of the
// public API.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// 'YYYY-MM-DD' and a day that exists. Shape alone isn't enough: '2027-02-31' parses, but as
// 3 March, and '2027-13-01' doesn't parse at all.
export function isCalendarDate(date: string): boolean {
  if (!ISO_DATE.test(date)) return false;
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString().startsWith(date);
}

// 'HH:mm' on a 24-hour clock, '00:00' to '23:59'
export function isClockTime(time: string): boolean {
  return CLOCK_TIME.test(time);
}

// The UTC calendar date of a moment, 'YYYY-MM-DD' (Date.now() → today on the server's clock)
export function utcDateOf(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

// The date a number of days later (or earlier, with a negative number)
export function addDaysToDate(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
