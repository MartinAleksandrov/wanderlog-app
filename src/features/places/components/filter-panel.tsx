import { Text } from '@/components/ui/text';
import { Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { chipCounts, isFiltered, type FilterablePlace, type PlaceFilters } from '../place-filters';
import type { PlaceMode } from '../place-modes';
import { Chip, OpenNowChip } from './filter-chips';

type FilterPanelProps = {
  mode: PlaceMode;
  // Every place on the map before filtering, to count each chip's places
  places: FilterablePlace[];
  filters: PlaceFilters;
  onSelect: (id: string | null) => void;
  onOpenNowChange: (openNow: boolean) => void;
  onClose: () => void;
};

// The map's filters, dropped down from the filter button: "Open now", then the kinds of place,
// wrapped onto as many lines as they need (no sideways scrolling on the map). Picking a kind
// closes the panel, since that's the choice made; "Open now" is a switch that goes with any
// kind, so the panel stays open for it.
export function FilterPanel({
  mode,
  places,
  filters,
  onSelect,
  onOpenNowChange,
  onClose,
}: FilterPanelProps) {
  const counts = chipCounts(mode, places, filters);
  // Kinds with places here; the picked one stays so it can be switched off
  const kinds = counts.kinds.filter(
    ({ filter, count }) => count > 0 || filter.id === filters.filter?.id,
  );

  function pick(id: string | null) {
    onSelect(id);
    onClose();
  }

  return (
    <Animated.View
      entering={FadeInUp.duration(180)}
      exiting={FadeOutUp.duration(120)}
      className="gap-3 rounded-3xl bg-background p-4 shadow-lg"
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold">Show {mode.label.toLowerCase()}</Text>
        {isFiltered(filters) ? (
          <Pressable
            onPress={() => {
              onOpenNowChange(false);
              pick(null);
            }}
            hitSlop={8}
          >
            <Text className="text-sm font-semibold text-blue-600">Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <View className="flex-row flex-wrap gap-2">
        <OpenNowChip
          count={counts.open}
          isOn={filters.openNow}
          onPress={() => onOpenNowChange(!filters.openNow)}
        />
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Chip
          mode={mode}
          label="All"
          isSelected={filters.filter === null}
          onPress={() => pick(null)}
        />
        {kinds.map(({ filter, count }) => (
          <Chip
            key={filter.id}
            mode={mode}
            icon={filter.icon}
            label={filter.label}
            count={count}
            isSelected={filter.id === filters.filter?.id}
            onPress={() => pick(filter.id === filters.filter?.id ? null : filter.id)}
          />
        ))}
      </View>
    </Animated.View>
  );
}
