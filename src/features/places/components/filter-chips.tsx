import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { ClockIcon, type LucideIcon } from 'lucide-react-native';
import { FlatList, Pressable, View } from 'react-native';
import { chipCounts, type FilterablePlace, type PlaceFilters } from '../place-filters';
import type { PlaceMode } from '../place-modes';

type FilterChipsProps = {
  mode: PlaceMode;
  // Every place shown before filtering (saved and suggested), to count each chip's places
  places: FilterablePlace[];
  filters: PlaceFilters;
  onSelect: (id: string | null) => void;
  onOpenNowChange: (openNow: boolean) => void;
  className?: string;
  contentClassName?: string;
};

// "Open now 12 | All · Coffee 8 · Bakery 5 · Brunch 2 · Dessert 3", in one row that scrolls
// sideways (the places list). "Open now" can go with any kind. Only kinds with places in the
// area show, so a small town doesn't offer empty ones; the picked kind stays even when it has
// none, so it can be switched off. Tapping the picked kind again goes back to All.
export function FilterChips({
  mode,
  places,
  filters,
  onSelect,
  onOpenNowChange,
  className,
  contentClassName,
}: FilterChipsProps) {
  const counts = chipCounts(mode, places, filters);
  const chips = counts.kinds.filter(
    ({ filter, count }) => count > 0 || filter.id === filters.filter?.id,
  );
  // Nothing to filter
  if (places.length === 0) return null;

  return (
    <FlatList
      horizontal
      data={chips}
      keyExtractor={({ filter }) => filter.id}
      // Re-render the chips when the picked one changes
      extraData={filters}
      showsHorizontalScrollIndicator={false}
      className={cn('grow-0', className)}
      contentContainerClassName={cn('gap-2', contentClassName)}
      ListHeaderComponent={
        <View className="flex-row gap-2">
          <OpenNowChip
            count={counts.open}
            isOn={filters.openNow}
            onPress={() => onOpenNowChange(!filters.openNow)}
          />
          <View className="my-1.5 w-px bg-border" />
          <Chip
            mode={mode}
            label="All"
            isSelected={filters.filter === null}
            onPress={() => onSelect(null)}
          />
        </View>
      }
      renderItem={({ item: { filter, count } }) => (
        <Chip
          mode={mode}
          icon={filter.icon}
          label={filter.label}
          count={count}
          isSelected={filter.id === filters.filter?.id}
          onPress={() => onSelect(filter.id === filters.filter?.id ? null : filter.id)}
        />
      )}
    />
  );
}

// A kind of place ("Coffee 8"), filled with the side's colour when picked
export function Chip({
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
  return (
    <ChipShell
      icon={icon}
      label={label}
      count={count}
      isOn={isSelected}
      onClass={mode.switchActive}
      onPress={onPress}
    />
  );
}

// "Open now 12": an on/off switch, green when on (Google Maps' "open" colour)
export function OpenNowChip({
  count,
  isOn,
  onPress,
}: {
  count: number;
  isOn: boolean;
  onPress: () => void;
}) {
  return (
    <ChipShell
      icon={ClockIcon}
      label="Open now"
      count={count}
      isOn={isOn}
      onClass="bg-green-600"
      onPress={onPress}
    />
  );
}

function ChipShell({
  icon,
  label,
  count,
  isOn,
  onClass,
  onPress,
}: {
  icon?: LucideIcon;
  label: string;
  count?: number;
  isOn: boolean;
  // The background while on
  onClass: string;
  onPress: () => void;
}) {
  const textColor = isOn ? 'text-white' : 'text-foreground';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isOn }}
      className={cn(
        'h-8 flex-row items-center gap-1.5 rounded-full px-3 shadow-sm',
        isOn ? onClass : 'border border-border bg-background active:bg-accent',
      )}
    >
      {icon ? <Icon as={icon} className={cn('size-3.5', textColor)} /> : null}
      <Text className={cn('text-sm font-medium', textColor)}>{label}</Text>
      {count === undefined ? null : (
        <Text className={cn('text-xs', isOn ? 'text-white/80' : 'text-muted-foreground')}>
          {count}
        </Text>
      )}
    </Pressable>
  );
}
