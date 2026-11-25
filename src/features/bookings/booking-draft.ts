import type { BookingInput, BookingType, Coordinates, TransportMode } from '@convex/schema';
import { amountText, parseAmount, type Booking } from './booking-format';

// The booking form's state: every field of every type as text, so switching fields on and off
// never loses what was typed. bookingFromDraft turns it into what the backend takes.
export type BookingDraft = {
  type: BookingType;
  mode: TransportMode;
  name: string;
  address: string;
  // Set when the stay was picked from Google's search (with providerPlaceId)
  coordinates?: Coordinates;
  providerPlaceId?: string;
  phone: string;
  website: string;
  flightNumber: string;
  airline: string;
  from: string;
  to: string;
  terminal: string;
  seat: string;
  startDate: string;
  startTime: string;
  // '' = no end (a stay always has one)
  endDate: string;
  endTime: string;
  confirmationCode: string;
  amount: string;
  currency: string;
  notes: string;
};

// A blank form for a new booking. Stays default to the whole trip; flights to landing the same
// day they leave. Other types start without an end.
export function newDraft(
  type: BookingType,
  trip: { startDate: string; endDate: string },
  currency: string,
): BookingDraft {
  return {
    type,
    mode: 'train',
    name: '',
    address: '',
    phone: '',
    website: '',
    flightNumber: '',
    airline: '',
    from: '',
    to: '',
    terminal: '',
    seat: '',
    startDate: trip.startDate,
    startTime: '',
    endDate: type === 'stay' ? trip.endDate : type === 'flight' ? trip.startDate : '',
    endTime: '',
    confirmationCode: '',
    amount: '',
    currency,
    notes: '',
  };
}

// The form filled in from a saved booking
export function draftFromBooking(booking: Booking): BookingDraft {
  // Its dates are replaced below
  const dates = { startDate: booking.startDate, endDate: booking.startDate };
  const blank = newDraft(booking.type, dates, booking.price?.currency ?? 'EUR');
  const draft: BookingDraft = {
    ...blank,
    startDate: booking.startDate,
    startTime: booking.startTime ?? '',
    endDate: booking.endDate ?? '',
    endTime: booking.endTime ?? '',
    confirmationCode: booking.confirmationCode ?? '',
    amount: booking.price ? amountText(booking.price.amountCents) : '',
    notes: booking.notes ?? '',
  };
  switch (booking.type) {
    case 'stay':
      return {
        ...draft,
        name: booking.name,
        address: booking.address ?? '',
        coordinates: booking.coordinates,
        providerPlaceId: booking.providerPlaceId,
        phone: booking.phone ?? '',
        website: booking.website ?? '',
      };
    case 'flight':
      return {
        ...draft,
        flightNumber: booking.flightNumber,
        airline: booking.airline ?? '',
        from: booking.from,
        to: booking.to,
        terminal: booking.terminal ?? '',
        seat: booking.seat ?? '',
      };
    case 'transport':
      return {
        ...draft,
        mode: booking.mode,
        name: booking.name,
        from: booking.from ?? '',
        to: booking.to ?? '',
      };
    case 'activity':
      return { ...draft, name: booking.name, address: booking.address ?? '' };
  }
}

// What's missing or wrong, in the order the form shows the fields; null when it can be saved.
// The backend checks the same, but asking here first means no round trip for a typo.
export function draftProblem(draft: BookingDraft): string | null {
  const blank = (text: string) => text.trim() === '';
  if (draft.type === 'flight') {
    if (blank(draft.flightNumber)) return 'Add the flight number.';
    if (blank(draft.from) || blank(draft.to)) return 'Add where the flight leaves from and lands.';
  } else if (blank(draft.name)) {
    return draft.type === 'stay' ? "Add where you're staying." : 'Add a name for the booking.';
  }
  if (draft.endDate !== '' && draft.type === 'stay') {
    const start = `${draft.startDate} ${draft.startTime || '00:00'}`;
    const end = `${draft.endDate} ${draft.endTime || '23:59'}`;
    if (end <= start) return 'Check-out has to be after check-in.';
  }
  if (!blank(draft.amount) && parseAmount(draft.amount) === null) {
    return 'The price should be a number, like 125.50.';
  }
  if (!blank(draft.amount) && !/^[A-Za-z]{3}$/.test(draft.currency.trim())) {
    return 'Currencies are 3-letter codes, like EUR or USD.';
  }
  return null;
}

// The draft as the backend takes it: only the current type's fields. Empty text is sent as is;
// the backend leaves it out.
export function bookingFromDraft(draft: BookingDraft): BookingInput {
  const amountCents = draft.amount.trim() === '' ? null : parseAmount(draft.amount);
  const base = {
    startDate: draft.startDate,
    startTime: draft.startTime || undefined,
    endTime: draft.endDate !== '' && draft.endTime !== '' ? draft.endTime : undefined,
    confirmationCode: draft.confirmationCode,
    notes: draft.notes,
    price:
      amountCents === null
        ? undefined
        : { amountCents, currency: draft.currency.trim().toUpperCase() },
  };
  const endDate = draft.endDate || undefined;

  switch (draft.type) {
    case 'stay':
      return {
        ...base,
        type: 'stay',
        name: draft.name,
        address: draft.address,
        coordinates: draft.coordinates,
        providerPlaceId: draft.providerPlaceId,
        phone: draft.phone,
        website: draft.website,
        endDate: draft.endDate,
      };
    case 'flight':
      return {
        ...base,
        type: 'flight',
        flightNumber: draft.flightNumber.toUpperCase(),
        airline: draft.airline,
        from: draft.from,
        to: draft.to,
        endDate,
        terminal: draft.terminal,
        seat: draft.seat.toUpperCase(),
      };
    case 'transport':
      return {
        ...base,
        type: 'transport',
        mode: draft.mode,
        name: draft.name,
        from: draft.from,
        to: draft.to,
        endDate,
      };
    case 'activity':
      return { ...base, type: 'activity', name: draft.name, address: draft.address, endDate };
  }
}
