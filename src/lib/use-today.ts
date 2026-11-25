import { useNow } from '@/lib/use-now';
import { toIsoDate } from '@/lib/dates';

// Today's date on the phone's calendar, 'YYYY-MM-DD', for screens that stay open for days (the
// tabs are never unmounted). Built on useNow, so it turns over at midnight. Calling
// todayIsoDate() while rendering would not: the React Compiler treats a value with no reactive
// inputs as never changing, and keeps what it built from the first day's date.
export function useToday(): string {
  const now = useNow();
  return toIsoDate(new Date(now));
}
