import { fromIsoDate } from '@/lib/dates';
import { APP_LOCALE } from '@/lib/locale';
import { ADMIN_COUNT_LIMIT } from '@convex/lib/limits';
import type { GoogleRequestKind } from '@convex/schema';

// Text for the admin dashboard's numbers, dates and request kinds

// What each kind of Google request is, in the words the dashboard uses
export const REQUEST_KIND_LABELS: Record<GoogleRequestKind, string> = {
  autocomplete: 'Search suggestions',
  details: 'Place details',
  nearby: 'Nearby places',
  textSearch: 'Word searches',
};

// A number of rows the dashboard counted: "1,284", or "2,000+" where it stopped counting
// (see ADMIN_COUNT_LIMIT)
export function formatRowCount(count: number): string {
  const text = formatNumber(count);
  return count >= ADMIN_COUNT_LIMIT ? `${text}+` : text;
}

export function formatNumber(count: number): string {
  return count.toLocaleString(APP_LOCALE);
}

// "Just now", "5 min ago", "3 h ago", "Yesterday", "4 days ago", then the date
export function formatLastSeen(time: number | undefined, now: number): string {
  if (time === undefined) return 'Not seen yet';
  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatJoined(time);
}

// "27 Nov 2026"
export function formatJoined(time: number): string {
  return new Date(time).toLocaleDateString(APP_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// A chart day ('YYYY-MM-DD'): "Fri" under its column, "Friday 27 Nov" above the chart
export function formatChartDay(day: string, long = false): string {
  return fromIsoDate(day).toLocaleDateString(
    APP_LOCALE,
    long ? { weekday: 'long', day: 'numeric', month: 'short' } : { weekday: 'short' },
  );
}
