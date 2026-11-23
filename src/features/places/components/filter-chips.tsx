import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react-native';
import { FlatList, Pressable } from 'react-native';
import { matchesFilter, type PlaceFilter, type PlaceMode } from '../place-modes';

type FilterChipsProps = {
  mode: PlaceMode;
  // The categories of every place shown (saved and suggested), to count each chip's places
  categories: (string | undefined)[];
  selected: PlaceFilter | null;
  onSelect: (id: string | null) => void;
  className?: string;
  contentClassName?: string;
};

// "All · Coffee 8 · Bakery 5 · Brunch 2 · Dessert 3": narrows the map and the list to one kind
// of place. Only chips with places in the area show, so a small town doesn't offer empty ones;
// the picked chip stays even when it has none, so it can be switched off. Tapping the picked
// chip again goes back to All.
export function FilterChips({
  mode,
  categories,
  selected,
  onSelect,
  className,
  contentClassName,
}: FilterChipsProps) {
  const chips = mode.filters
    .map((filter) => ({
      filter,
      count: categories.filter((category) => matchesFilter(category, filter)).length,
    }))
    .filter(({ filter, count }) => count > 0 || filter.id === selected?.id);
  // Nothing to tell apart
  if (chips.length === 0) return null;

  return (
    <FlatList
      horizontal
      data={chips}
      keyExtractor={({ filter }) => filter.id}
      // Re-render the chips when the picked one changes
      extraData={selected}
      showsHorizontalScrollIndicator={false}
      className={cn('grow-0', className)}
      contentContainerClassName={cn('gap-2', contentClassName)}
      ListHeaderComponent={
        <Chip
          mode={mode}
          label="All"
          isSelected={selected === null}
          onPress={() => onSelect(null)}
        />
      }
      renderItem={({ item: { filter, count } }) => (
        <Chip
          mode={mode}
          icon={filter.icon}
          label={filter.label}
          count={count}
          isSelected={filter.id === selected?.id}
          onPress={() => onSelect(filter.id === selected?.id ? null : filter.id)}
        />
      )}
    />
  );
}

function Chip({
  mode,
  icon,
  label,
  count,
  isSelected,
  onPress,
}: {
  mode: PlaceMode;
  icon?: LucideIcon;
  label: string;
  count?: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  const textColor = isSelected ? 'text-white' : 'text-foreground';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      className={cn(
        'h-8 flex-row items-center gap-1.5 rounded-full px-3 shadow-sm',
        isSelected ? mode.switchActive : 'border border-border bg-background active:bg-accent',
      )}
    >
      {icon ? <Icon as={icon} className={cn('size-3.5', textColor)} /> : null}
      <Text className={cn('text-sm font-medium', textColor)}>{label}</Text>
      {count === undefined ? null : (
        <Text className={cn('text-xs', isSelected ? 'text-white/80' : 'text-muted-foreground')}>
          {count}
        </Text>
      )}
    </Pressable>
  );
}
