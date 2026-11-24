import type { PlaceHours } from '@convex/googlePlaces';

// "Open · closes 18:00", "Closes soon · 18:00" or "Closed · opens 08:00"
export type OpenStatus = { tone: 'open' | 'closing' | 'closed'; label: string };

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
// Within this, an open place "closes soon"
const CLOSING_SOON_MS = 60 * MINUTE_MS;
// Google's answer is cached, so it may be from a while ago. When the change it announced
// happened since, the place has flipped (a café that closed at 18:00 is closed now), but what
// came after that isn't known: after this long, show nothing rather than guess.
const UNKNOWN_AFTER_MS = 3 * 60 * MINUTE_MS;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Whether the place is open at `now`, worked out from Google's answer (convex/googlePlaces.ts),
// with the times on the place's own clock. null when its hours aren't known.
export function openStatus(hours: PlaceHours | undefined, now: number): OpenStatus | null {
  if (hours === undefined) return null;
  const closesAt = timeOf(hours.nextCloseTime);
  const opensAt = timeOf(hours.nextOpenTime);
  const at = (time: number) => placeClock(time, now, hours.utcOffsetMinutes);

  if (hours.openNow) {
    // Open 24 hours, or closing more than a week from now
    if (closesAt === undefined) return { tone: 'open', label: 'Open now' };
    if (now < closesAt) {
      return closesAt - now <= CLOSING_SOON_MS
        ? { tone: 'closing', label: `Closes soon · ${at(closesAt)}` }
        : { tone: 'open', label: `Open · closes ${at(closesAt)}` };
    }
    // It has closed since Google was asked; when it opens again isn't known
    return now - closesAt < UNKNOWN_AFTER_MS ? { tone: 'closed', label: 'Closed' } : null;
  }

  // Closed for more than a week, or for good
  if (opensAt === undefined) return { tone: 'closed', label: 'Closed' };
  if (now < opensAt) return { tone: 'closed', label: `Closed · opens ${at(opensAt)}` };
  // It has opened since Google was asked; when it closes again isn't known
  return now - opensAt < UNKNOWN_AFTER_MS ? { tone: 'open', label: 'Open now' } : null;
}

// For the "Open now" filter: open right now, including "closes soon"
export function isOpen(status: OpenStatus | null): boolean {
  return status !== null && status.tone !== 'closed';
}

function timeOf(rfc3339: string | undefined): number | undefined {
  if (rfc3339 === undefined) return undefined;
  const time = Date.parse(rfc3339);
  return Number.isNaN(time) ? undefined : time;
}

// "18:00" on the place's clock, or "Mon 08:00" when it's more than a day away. With the place's
// UTC offset, the time is right even while the phone is still on home time; without it, the
// phone's clock is the best guess.
function placeClock(time: number, now: number, utcOffsetMinutes: number | undefined): string {
  const date =
    utcOffsetMinutes === undefined
      ? new Date(time - new Date(time).getTimezoneOffset() * MINUTE_MS)
      : new Date(time + utcOffsetMinutes * MINUTE_MS);
  const hhmm = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  return time - now < DAY_MS ? hhmm : `${WEEKDAYS[date.getUTCDay()]} ${hhmm}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
