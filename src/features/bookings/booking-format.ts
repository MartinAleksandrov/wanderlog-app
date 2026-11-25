import { daysBetween, formatWeekdayDate } from '@/lib/dates';
import type { Doc } from '@convex/_generated/dataModel';
import type { BookingType, Money, TransportMode } from '@convex/schema';
import { TRANSPORT_MODES } from './booking-kinds';

// Pure helpers that turn stored bookings into what the screens show. No React, so they're easy
// to check on their own.

export type Booking = Doc<'bookings'>;

// One moment of a booking that belongs on a day: a check-in or check-out, a departure, a rental
// car's pick-up or return. The plan shows a day's events; the home card shows the next one.
export type BookingEvent = {
  booking: Booking;
  edge: 'start' | 'end';
  // 'YYYY-MM-DD'
  date: string;
  // 'HH:mm', when known
  time?: string;
};

// The main line of a booking: the hotel, "LH 1234", "Eurostar 9014"
export function bookingTitle(booking: Booking): string {
  return booking.type === 'flight' ? booking.flightNumber : booking.name;
}

// "SOF → MUC", when the booking has both ends
export function bookingRoute(booking: Booking): string | undefined {
  if (booking.type !== 'flight' && booking.type !== 'transport') return undefined;
  if (booking.from === undefined || booking.to === undefined) return undefined;
  return `${booking.from} → ${booking.to}`;
}

// What a booking's start and end are called (check-in and check-out, departs and lands…), and
// the end in a sentence: "Add landing"
export function whenLabels(type: BookingType, mode: TransportMode | undefined) {
  switch (type) {
    case 'stay':
      return { start: 'Check-in', end: 'Check-out', endNoun: 'check-out' };
    case 'flight':
      return { start: 'Departs', end: 'Lands', endNoun: 'landing' };
    case 'transport':
      return mode === 'car'
        ? { start: 'Pick-up', end: 'Return', endNoun: 'return' }
        : { start: 'Departs', end: 'Arrives', endNoun: 'arrival' };
    case 'activity':
      return { start: 'Starts', end: 'Ends', endNoun: 'end time' };
  }
}

// "Fri, 12 Jun · 15:00", or only the date when there's no time
export function formatWhen(date: string, time: string | undefined): string {
  return time ? `${formatWeekdayDate(date)} · ${time}` : formatWeekdayDate(date);
}

// The moments of every booking, in time order. Each booking starts; stays and rental cars also
// end on their own line (check-out, return the car), and so does any journey that arrives on a
// later day (a night train). Same-day arrivals are already on the departure's line.
export function bookingEvents(bookings: Booking[]): BookingEvent[] {
  const events = bookings.flatMap((booking): BookingEvent[] => {
    const start: BookingEvent = {
      booking,
      edge: 'start',
      date: booking.startDate,
      time: booking.startTime,
    };
    if (booking.endDate === undefined) return [start];
    const endsOnItsOwnLine =
      booking.type === 'stay' ||
      (booking.type === 'transport' && booking.mode === 'car') ||
      booking.endDate > booking.startDate;
    if (!endsOnItsOwnLine) return [start];
    return [start, { booking, edge: 'end', date: booking.endDate, time: booking.endTime }];
  });
  // A moment without a time sorts first in its day ('' comes before any 'HH:mm')
  return events.sort((a, b) =>
    `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`),
  );
}

// What happens at an event, in a few words: "Check-in · Hotel Lisboa", "Flight LH 1234 · SOF → MUC"
export function eventLabel({ booking, edge }: BookingEvent): string {
  const route = bookingRoute(booking);
  switch (booking.type) {
    case 'stay':
      return `${edge === 'start' ? 'Check-in' : 'Check-out'} · ${booking.name}`;
    case 'flight':
      return edge === 'start'
        ? `Flight ${booking.flightNumber}${route ? ` · ${route}` : ''}`
        : `Land in ${booking.to} · ${booking.flightNumber}`;
    case 'transport':
      if (booking.mode === 'car') {
        return `${edge === 'start' ? 'Pick up' : 'Return'} rental car · ${booking.name}`;
      }
      return edge === 'start'
        ? `${TRANSPORT_MODES[booking.mode].label} ${booking.name}${route ? ` · ${route}` : ''}`
        : `Arrive${booking.to ? ` in ${booking.to}` : ''} · ${booking.name}`;
    case 'activity':
      return edge === 'start' ? booking.name : `Ends · ${booking.name}`;
  }
}

// The first event that hasn't happened yet. One without a time counts as upcoming all its day,
// unless its booking is already over (a car picked up some time today and returned at 18:00).
export function nextEvent(
  events: BookingEvent[],
  today: string,
  nowTime: string,
): BookingEvent | undefined {
  const hasPassed = (date: string, time: string | undefined) =>
    date < today || (date === today && (time ?? '23:59') < nowTime);
  return events.find(({ booking, edge, date, time }) => {
    if (hasPassed(date, time)) return false;
    const isOver =
      edge === 'start' &&
      booking.endDate !== undefined &&
      hasPassed(booking.endDate, booking.endTime);
    return !isOver;
  });
}

// "Today", "Tomorrow", "In 3 days", or the date itself further away or in the past
export function relativeDay(date: string, today: string): string {
  const days = daysBetween(today, date);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1 && days < 7) return `In ${days} days`;
  return formatWeekdayDate(date);
}

// "3 nights", for a stay
export function nightsLabel(startDate: string, endDate: string): string {
  const nights = daysBetween(startDate, endDate);
  if (nights === 0) return 'Day use';
  return nights === 1 ? '1 night' : `${nights} nights`;
}

// "€125.50" in the phone's language. Intl rejects a code it can't use; then "125.50 XYZ".
export function formatMoney({ amountCents, currency }: Money): string {
  const amount = amountCents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

// What all the priced bookings add up to, a sum per currency: "€1,240.00 + $300.00"
export function totalPrice(bookings: Booking[]): string | undefined {
  const totals = new Map<string, number>();
  for (const { price } of bookings) {
    if (price) totals.set(price.currency, (totals.get(price.currency) ?? 0) + price.amountCents);
  }
  if (totals.size === 0) return undefined;
  return [...totals]
    .map(([currency, amountCents]) => formatMoney({ amountCents, currency }))
    .join(' + ');
}

// A price as the user typed it, in cents, or null when it isn't one. Takes a comma or a point
// before the cents, and thousands separators: "125", "125,5", "1.250", "1,250.00", "12 345,67".
// One or two digits after the last separator are cents; three are thousands.
export function parseAmount(text: string): number | null {
  const compact = text.replace(/[\s'’]/g, '');
  const match = /^(\d[\d.,]*?)(?:[.,](\d{1,2}))?$/.exec(compact);
  if (match === null) return null;
  const [, whole = '', cents = ''] = match;
  // Separators left in the whole part must group thousands: "1.250", not "1.2.5"
  if (!/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(whole)) return null;
  return Number(whole.replace(/[.,]/g, '')) * 100 + Number(cents.padEnd(2, '0'));
}

// Cents back to text for the price field: "125" or "125.50"
export function amountText(amountCents: number): string {
  return amountCents % 100 === 0 ? String(amountCents / 100) : (amountCents / 100).toFixed(2);
}
