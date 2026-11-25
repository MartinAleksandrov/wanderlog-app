import type { BookingType, TransportMode } from '@convex/schema';
import {
  BedDoubleIcon,
  BusIcon,
  CarIcon,
  PlaneIcon,
  RouteIcon,
  ShipIcon,
  TicketIcon,
  TrainFrontIcon,
  type LucideIcon,
} from 'lucide-react-native';

// How each type of booking looks across the app: its name, icon and colour. One table, so the
// list, the form, the plan and the home card can't disagree. The class names are written out in
// full because Tailwind only generates classes it finds as whole words in the source.
export const BOOKING_KINDS: Record<
  BookingType,
  {
    label: string;
    // In sentences: "Edit stay", "Delete this stay?"
    noun: string;
    // The add button's label and the new form's title, with the right article
    add: string;
    // An example for the notes field
    notesHint: string;
    icon: LucideIcon;
    // Background of the round icon tile, and the icon's colour on it
    tile: string;
    tint: string;
  }
> = {
  stay: {
    label: 'Stay',
    noun: 'stay',
    add: 'Add a stay',
    notesHint: 'Breakfast included, late check-out asked for…',
    icon: BedDoubleIcon,
    tile: 'bg-indigo-100 dark:bg-indigo-950',
    tint: 'text-indigo-600 dark:text-indigo-300',
  },
  flight: {
    label: 'Flight',
    noun: 'flight',
    add: 'Add a flight',
    notesHint: 'One checked bag, online check-in opens 24 h before…',
    icon: PlaneIcon,
    tile: 'bg-sky-100 dark:bg-sky-950',
    tint: 'text-sky-600 dark:text-sky-300',
  },
  transport: {
    label: 'Transport',
    noun: 'transport',
    add: 'Add transport',
    notesHint: 'Coach 7, show the ticket in the app…',
    icon: TrainFrontIcon,
    tile: 'bg-emerald-100 dark:bg-emerald-950',
    tint: 'text-emerald-600 dark:text-emerald-300',
  },
  activity: {
    label: 'Activity',
    noun: 'activity',
    add: 'Add an activity',
    notesHint: 'Meet at the main entrance 15 minutes early…',
    icon: TicketIcon,
    tile: 'bg-amber-100 dark:bg-amber-950',
    tint: 'text-amber-600 dark:text-amber-300',
  },
};

// The order the "Add a booking" buttons appear in
export const BOOKING_TYPE_ORDER: BookingType[] = ['stay', 'flight', 'transport', 'activity'];

export const TRANSPORT_MODES: Record<TransportMode, { label: string; icon: LucideIcon }> = {
  train: { label: 'Train', icon: TrainFrontIcon },
  bus: { label: 'Bus', icon: BusIcon },
  ferry: { label: 'Ferry', icon: ShipIcon },
  car: { label: 'Rental car', icon: CarIcon },
  other: { label: 'Other', icon: RouteIcon },
};

export const TRANSPORT_MODE_ORDER: TransportMode[] = ['train', 'bus', 'ferry', 'car', 'other'];
