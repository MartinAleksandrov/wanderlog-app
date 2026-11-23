import { addDays, daysBetween, fromIsoDate } from './trip-dates';

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
