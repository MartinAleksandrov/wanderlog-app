import { addDays, daysBetween, formatDate, fromIsoDate } from '@/lib/dates';

// One day of a trip, for the day chips and headings
export type TripDay = {
  // 1 = the trip's first day (what the backend stores)
  day: number;
  // 'YYYY-MM-DD'
  date: string;
  // "Mon"
  weekday: string;
  // "23 Nov"
  label: string;
};

// Every day of a trip, first to last, labelled in the phone's language
export function tripDays(startDate: string, endDate: string): TripDay[] {
  const count = daysBetween(startDate, endDate) + 1;
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(startDate, index);
    const local = fromIsoDate(date);
    return {
      day: index + 1,
      date,
      weekday: local.toLocaleDateString(undefined, { weekday: 'short' }),
      label: local.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    };
  });
}

// Which day of the trip today is, or null when the trip isn't happening today
export function todayDayNumber(startDate: string, endDate: string, today: string): number | null {
  if (today < startDate || today > endDate) return null;
  return daysBetween(startDate, today) + 1;
}

// A short line about where the trip is in time: "Starts in 12 days", "Day 2 of 5", "Ended …"
export function tripStatus(startDate: string, endDate: string, today: string): string {
  if (today < startDate) {
    const days = daysBetween(today, startDate);
    return days === 1 ? 'Starts tomorrow' : `Starts in ${days} days`;
  }
  if (today > endDate) return `Ended ${formatDate(endDate)}`;
  return `Happening now · day ${daysBetween(startDate, today) + 1} of ${daysBetween(startDate, endDate) + 1}`;
}
