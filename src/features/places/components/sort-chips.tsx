import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import {
  ArrowDownWideNarrowIcon,
  MessageSquareTextIcon,
  NavigationIcon,
  StarIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import type { PlaceSort } from '../place-ranking';
import type { PlaceMode } from '../place-modes';
import { Chip } from './filter-chips';

type SortOption = {
  label: string;
  // The section titles' note on the right
  firstLabel: string;
  icon: LucideIcon;
  // The note's colour: blue for distance, as the phone's dot on the map
  noteClass: string;
};

const SORT_OPTIONS: Record<PlaceSort, SortOption> = {
  rating: {
    label: 'Top rated',
    firstLabel: 'Top rated first',
    icon: StarIcon,
    noteClass: 'text-muted-foreground',
  },
  reviews: {
    label: 'Most reviewed',
    firstLabel: 'Most reviewed first',
    icon: MessageSquareTextIcon,
    noteClass: 'text-muted-foreground',
  },
  distance: {
    label: 'Closest',
    firstLabel: 'Closest first',
    icon: NavigationIcon,
    noteClass: 'text-blue-600',
  },
};

// The chips, in this order
const SORTS: PlaceSort[] = ['rating', 'reviews', 'distance'];

type SortChipsProps = {
  mode: PlaceMode;
  sort: PlaceSort;
  // Closest is offered only in the city, where the phone's distance to each place is known
  isInCity: boolean;
  onChange: (sort: PlaceSort) => void;
  className?: string;
  contentClassName?: string;
};

// "⇅ Sort  ★ Top rated · Most reviewed · Closest" under the filter chips of every side, in the
// side's colour like them. One is always picked: tapping another switches to it. It orders both
// lists (saved and suggested) without hiding any place. Scrolls sideways on a narrow phone.
export function SortChips({
  mode,
  sort,
  isInCity,
  onChange,
  className,
  contentClassName,
}: SortChipsProps) {
  const options = SORTS.filter((option) => option !== 'distance' || isInCity);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={cn('grow-0', className)}
      contentContainerClassName={cn('items-center gap-2', contentClassName)}
    >
      <Icon as={ArrowDownWideNarrowIcon} className="size-4 text-muted-foreground" />
      <Text className="text-sm text-muted-foreground">Sort</Text>
      {options.map((option) => (
        <Chip
          key={option}
          mode={mode}
          icon={SORT_OPTIONS[option].icon}
          label={SORT_OPTIONS[option].label}
          isSelected={option === sort}
          onPress={() => onChange(option)}
        />
      ))}
    </ScrollView>
  );
}

// "★ Top rated first" on the right of the section titles, so the order is still clear once the
// chips have scrolled away
export function SortNote({ sort }: { sort: PlaceSort }) {
  const option = SORT_OPTIONS[sort];
  return (
    <View className="flex-row items-center gap-1">
      <Icon as={option.icon} className={cn('size-3', option.noteClass)} />
      <Text className={cn('text-xs font-medium', option.noteClass)}>{option.firstLabel}</Text>
    </View>
  );
}
