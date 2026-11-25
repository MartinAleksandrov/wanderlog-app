import type { PlaceKind } from '@convex/schema';
import {
  BinocularsIcon,
  CakeSliceIcon,
  CastleIcon,
  CheckIcon,
  ChurchIcon,
  CoffeeIcon,
  CroissantIcon,
  EggFriedIcon,
  HeartIcon,
  LandmarkIcon,
  TreesIcon,
  type LucideIcon,
} from 'lucide-react-native';

import type { MapStyleElement } from 'react-native-maps';

// The app's two sides, switched at the top of the map and places tabs:
//   sight = places to visit: orange suggestions, purple trip places, the normal Google map
//   sweet = sweet spots (bakeries, cafes, brunch, desserts): pink suggestions, chocolate-brown
//           saved spots with a heart, on a warm cream map
// Both sides use the same screens and components; everything that differs lives here. Class
// names are written out in full (never built from pieces) so Tailwind finds them.

// A filter chip ("Coffee", "Parks"): a place matches when Google's category for it ("Coffee
// Shop", "City Park"…) contains one of the words
export type PlaceFilter = { id: string; label: string; icon: LucideIcon; words: string[] };

export function matchesFilter(category: string | undefined, filter: PlaceFilter): boolean {
  const text = category?.toLowerCase() ?? '';
  return filter.words.some((word) => text.includes(word));
}

// How one kind of pin looks (see components/place-pin.tsx)
export type PinLook = {
  body: string;
  text: string;
  tail: string;
  ring: string;
  dot: string;
  iconCircle: string;
  icon: string;
};

export type PlaceMode = {
  kind: PlaceKind;
  // The switch: "Sights" | "Sweet spots"
  label: string;
  icon: LucideIcon;
  // The places tab's header
  title: string;
  tagline: string;
  // "20 places" / "14 sweet spots"
  count: (n: number) => string;
  // The two lists, as section titles and in the legend
  savedTitle: string;
  suggestedTitle: string;
  // Buttons and tags
  addLabel: string;
  savedLabel: string;
  removeLabel: string;
  // "Remove Café X from your sweet spots?"
  listName: string;
  // Marks a saved place: on its pin, its tag and its button
  savedIcon: LucideIcon;
  pins: { suggested: PinLook; saved: PinLook };
  // Colour of the saved mark on the pin's white badge
  pinBadge: string;
  // The add button (suggestion colour) and the saved button (saved colour)
  addButton: string;
  savedButton: string;
  // The "In your trip" / "Saved" tag
  tag: string;
  tagText: string;
  // The outline of the map's pop-up card and the places list's cards
  cardBorder: string;
  // The switch's selected segment, and the places tab's header banner
  switchActive: string;
  banner: string;
  bannerIcon: string;
  // The legend's sample dots
  legend: { suggested: string; saved: string };
  // The filter chips under the switch, in this order
  filters: PlaceFilter[];
  // Google map styling; [] is Google's normal map
  mapStyle: MapStyleElement[];
};

// Sweet spots' map: warm cream land, pastel water, white streets. Google's own shop and
// restaurant icons are hidden so they don't compete with our pins.
const CREAM_MAP: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#f8f0e5' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7a5a48' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#fffaf3' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#f1e4d3' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e2ead0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fbe3d3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f6cdb8' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cde4ec' }] },
];

export const PLACE_MODES: Record<PlaceKind, PlaceMode> = {
  sight: {
    kind: 'sight',
    label: 'Sights',
    icon: LandmarkIcon,
    title: 'Places to visit',
    tagline: 'Museums, landmarks, viewpoints and parks',
    count: (n) => (n === 1 ? '1 place' : `${n} places`),
    savedTitle: 'In your trip',
    suggestedTitle: 'Suggested places',
    addLabel: 'Add to trip',
    savedLabel: 'In your trip',
    removeLabel: 'Remove from trip',
    listName: 'your trip',
    savedIcon: CheckIcon,
    // A suggestion is a white label with an orange outline: dark text on white reads better
    // on the map than white text on orange. A trip place is solid purple with a check mark.
    pins: {
      suggested: {
        body: 'border-orange-500 bg-white',
        text: 'text-neutral-900',
        tail: 'border-t-orange-500',
        ring: 'bg-orange-500/35',
        dot: 'bg-orange-500',
        iconCircle: 'bg-orange-100',
        icon: 'text-orange-600',
      },
      saved: {
        body: 'border-white bg-purple-600',
        text: 'text-white',
        tail: 'border-t-purple-600',
        ring: 'bg-purple-600/35',
        dot: 'bg-purple-600',
        iconCircle: 'bg-white/25',
        icon: 'text-white',
      },
    },
    pinBadge: 'text-purple-600',
    addButton: 'bg-orange-500 active:bg-orange-600',
    savedButton: 'bg-purple-600 active:bg-purple-700',
    tag: 'bg-purple-100 dark:bg-purple-950',
    tagText: 'text-purple-700 dark:text-purple-300',
    cardBorder: 'border-border',
    switchActive: 'bg-orange-500',
    banner: 'bg-orange-50 dark:bg-orange-950/40',
    bannerIcon: 'bg-orange-500',
    legend: { suggested: 'border-orange-500 bg-white', saved: 'border-white bg-purple-600' },
    filters: [
      { id: 'museums', label: 'Museums', icon: LandmarkIcon, words: ['museum', 'gallery'] },
      {
        id: 'landmarks',
        label: 'Landmarks',
        icon: CastleIcon,
        words: ['landmark', 'monument', 'castle', 'palace', 'fortress', 'attraction', 'ruins'],
      },
      { id: 'parks', label: 'Parks', icon: TreesIcon, words: ['park', 'garden'] },
      {
        id: 'churches',
        label: 'Churches',
        icon: ChurchIcon,
        words: ['church', 'cathedral', 'chapel', 'monastery', 'mosque', 'synagogue', 'temple'],
      },
      {
        id: 'views',
        label: 'Views',
        icon: BinocularsIcon,
        words: ['observation', 'scenic', 'viewpoint', 'lookout'],
      },
    ],
    mapStyle: [],
  },
  sweet: {
    kind: 'sweet',
    label: 'Sweet spots',
    icon: CroissantIcon,
    title: 'Sweet spots',
    tagline: 'Bakeries, cafes, brunch and desserts rated above 4.0 by 50+ people',
    count: (n) => (n === 1 ? '1 sweet spot' : `${n} sweet spots`),
    savedTitle: 'Your sweet spots',
    suggestedTitle: 'Suggested sweet spots',
    addLabel: 'Save sweet spot',
    savedLabel: 'Saved',
    removeLabel: 'Remove',
    listName: 'your sweet spots',
    savedIcon: HeartIcon,
    // Strawberry and chocolate: suggestions are white labels with a pink outline, saved
    // spots solid chocolate brown with a pink heart
    pins: {
      suggested: {
        body: 'border-pink-500 bg-white',
        text: 'text-neutral-900',
        tail: 'border-t-pink-500',
        ring: 'bg-pink-500/35',
        dot: 'bg-pink-500',
        iconCircle: 'bg-pink-100',
        icon: 'text-pink-600',
      },
      saved: {
        body: 'border-white bg-amber-900',
        text: 'text-white',
        tail: 'border-t-amber-900',
        ring: 'bg-amber-900/35',
        dot: 'bg-amber-900',
        iconCircle: 'bg-white/25',
        icon: 'text-white',
      },
    },
    pinBadge: 'text-pink-500',
    addButton: 'bg-pink-500 active:bg-pink-600',
    savedButton: 'bg-amber-900 active:bg-amber-950',
    tag: 'bg-pink-100 dark:bg-pink-950',
    tagText: 'text-pink-700 dark:text-pink-300',
    cardBorder: 'border-pink-200 dark:border-pink-900',
    switchActive: 'bg-pink-500',
    banner: 'bg-pink-50 dark:bg-pink-950/40',
    bannerIcon: 'bg-pink-500',
    legend: { suggested: 'border-pink-500 bg-white', saved: 'border-white bg-amber-900' },
    filters: [
      // "tea house", not "tea": that would also match "Steak House"
      {
        id: 'coffee',
        label: 'Coffee',
        icon: CoffeeIcon,
        words: ['coffee', 'cafe', 'café', 'espresso', 'tea house'],
      },
      {
        id: 'bakery',
        label: 'Bakery',
        icon: CroissantIcon,
        words: ['bakery', 'pastry', 'bagel', 'croissant'],
      },
      { id: 'brunch', label: 'Brunch', icon: EggFriedIcon, words: ['breakfast', 'brunch'] },
      {
        id: 'dessert',
        label: 'Dessert',
        icon: CakeSliceIcon,
        words: ['dessert', 'cake', 'ice cream', 'gelato', 'donut', 'chocolate', 'confection'],
      },
    ],
    mapStyle: CREAM_MAP,
  },
};

// Which list a saved place is on: the backend's own rule, so both sides agree
export { placeKindOf } from '@convex/lib/placeKind';
