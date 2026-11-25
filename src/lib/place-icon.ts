import {
  BeefIcon,
  BinocularsIcon,
  BookOpenIcon,
  CakeSliceIcon,
  CastleIcon,
  ChurchIcon,
  CoffeeIcon,
  CroissantIcon,
  DonutIcon,
  EggFriedIcon,
  FishIcon,
  IceCreamConeIcon,
  LandmarkIcon,
  MusicIcon,
  PaletteIcon,
  PizzaIcon,
  SaladIcon,
  SoupIcon,
  StoreIcon,
  TreesIcon,
  UtensilsIcon,
  WineIcon,
  type LucideIcon,
} from 'lucide-react-native';

// Which icon stands for which kind of place, matched against words in Google's place type
// ("City Park", "Art gallery", "Coffee Shop"…). In each list the first match wins.
type IconWords = [words: string[], icon: LucideIcon][];

// Sweet spots, checked first: "Coffee Shop" is a cup, not the shop icon further down, and
// "Brunch Restaurant" an egg, not a fork and knife
const SWEET_ICONS: IconWords = [
  [['ice cream', 'gelato'], IceCreamConeIcon],
  [['donut', 'doughnut'], DonutIcon],
  [['breakfast', 'brunch'], EggFriedIcon],
  [['coffee', 'cafe', 'café', 'tea house', 'espresso'], CoffeeIcon],
  [['bakery', 'pastry', 'croissant', 'bagel'], CroissantIcon],
  [['cake', 'dessert', 'chocolate', 'confection', 'sweet', 'candy'], CakeSliceIcon],
];

// What makes a place a restaurant. Only then do the cuisine words count, so an "Asian Grocery
// Store" keeps the shop icon and a "Japanese Garden" the trees.
const RESTAURANT_WORDS = ['restaurant', 'steak house', 'bistro', 'diner', 'grill', 'eatery'];

// Restaurants by cuisine; any other restaurant gets a fork and knife
const CUISINE_ICONS: IconWords = [
  [['pizza', 'italian'], PizzaIcon],
  [['sushi', 'seafood', 'fish'], FishIcon],
  [
    ['ramen', 'noodle', 'asian', 'chinese', 'japanese', 'korean', 'thai', 'vietnamese', 'indian'],
    SoupIcon,
  ],
  [['steak', 'barbecue', 'grill', 'burger', 'brazilian'], BeefIcon],
  [['vegan', 'vegetarian', 'salad'], SaladIcon],
];

// Sights and everything else
const SIGHT_ICONS: IconWords = [
  [['castle', 'palace', 'fortress'], CastleIcon],
  [['church', 'cathedral', 'chapel', 'mosque', 'synagogue', 'temple', 'shrine'], ChurchIcon],
  [['park', 'garden', 'forest', 'zoo'], TreesIcon],
  [['scenic', 'observation', 'viewpoint', 'lookout'], BinocularsIcon],
  [['gallery', 'art'], PaletteIcon],
  [['market', 'store', 'shop', 'mall'], StoreIcon],
  [['concert', 'theater', 'theatre', 'opera', 'music', 'philharmonic'], MusicIcon],
  [['book', 'library'], BookOpenIcon],
  [['winery', 'vineyard', 'wine'], WineIcon],
];

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function iconFrom(text: string, icons: IconWords): LucideIcon | undefined {
  return icons.find(([words]) => hasAny(text, words))?.[1];
}

// The icon shown for a place without a photo. Museums, monuments and anything unknown get a
// classical building.
export function placeIcon(category?: string): LucideIcon {
  const text = category?.toLowerCase() ?? '';
  const sweet = iconFrom(text, SWEET_ICONS);
  if (sweet) return sweet;
  if (hasAny(text, RESTAURANT_WORDS)) return iconFrom(text, CUISINE_ICONS) ?? UtensilsIcon;
  return iconFrom(text, SIGHT_ICONS) ?? LandmarkIcon;
}
