// Calendar dates, 'YYYY-MM-DD', as trips and bookings store them (see convex/schema.ts). These
// helpers convert them to and from the phone's local calendar without going through UTC, so a
// date never moves by a day because of the time zone. Shared by every feature, so they live
// here rather than inside one of them.

const DAY_MS = 24 * 60 * 60 * 1000;

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Local midnight of that calendar day
export function fromIsoDate(isoDate: string): Date {
  const [year = 1970, month = 1, day = 1] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function todayIsoDate(): string {
  return toIsoDate(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const date = fromIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

// Whole days from one date to another. Rounded, because a day with a daylight-saving change
// is 23 or 25 hours long.
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((fromIsoDate(toIso).getTime() - fromIsoDate(fromIso).getTime()) / DAY_MS);
}

// "12 Mar 2027", in the phone's language
export function formatDate(isoDate: string): string {
  return fromIsoDate(isoDate).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// "12 Mar – 15 Mar 2027"
export function formatDateRange(startDate: string, endDate: string): string {
  const start = fromIsoDate(startDate).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
  return `${start} – ${formatDate(endDate)}`;
}

// "Fri, 12 Jun", for a list's day headings (the year is the trip's, so it's left out)
export function formatWeekdayDate(isoDate: string): string {
  return fromIsoDate(isoDate).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

// A moment's local clock time, 'HH:mm' (24-hour, as bookings store times)
export function toClockTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
