import {
  BinocularsIcon,
  BookOpenIcon,
  CastleIcon,
  ChurchIcon,
  LandmarkIcon,
  MusicIcon,
  PaletteIcon,
  StoreIcon,
  TreesIcon,
  WineIcon,
  type LucideIcon,
} from 'lucide-react-native';

// Which icon stands for which kind of place, matched against words in Google's place type
// ("City Park", "Art gallery", "Scenic Spot"…). The first match wins.
const ICONS: [words: string[], icon: LucideIcon][] = [
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

// The icon shown for a place without a photo. Museums, monuments and anything unknown get a
// classical building.
export function placeIcon(category?: string): LucideIcon {
  const text = category?.toLowerCase() ?? '';
  return ICONS.find(([words]) => words.some((word) => text.includes(word)))?.[1] ?? LandmarkIcon;
}
