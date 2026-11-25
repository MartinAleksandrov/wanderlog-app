import { Text } from '@/components/ui/text';
import type { TripDay } from '@/features/trips';
import { cn } from '@/lib/utils';
import { FlatList, Pressable, View } from 'react-native';

type DayPickerProps = {
  days: TripDay[];
  selected: number;
  // Which day of the trip today is, if the trip is happening
  today: number | null;
  // How many stops each day has, by day number
  stopCounts: Map<number, number>;
  onSelect: (day: number) => void;
};

// The trip's days side by side, swipe for more: "Today / Day 2 / 24 Nov", with a dot per stop
// planned (up to 5). The picked day is dark; the others are cards. A list that only draws the
// days near the screen, since a long trip can have weeks of them.
export function DayPicker({ days, selected, today, stopCounts, onSelect }: DayPickerProps) {
  return (
    <FlatList
      horizontal
      data={days}
      keyExtractor={(tripDay) => String(tripDay.day)}
      // Re-render the chips when the selection or the stop counts change
      extraData={{ selected, stopCounts }}
      showsHorizontalScrollIndicator={false}
      className="grow-0"
      contentContainerClassName="gap-2 px-4"
      renderItem={({ item }) => (
        <DayChip
          tripDay={item}
          isSelected={item.day === selected}
          isToday={item.day === today}
          count={stopCounts.get(item.day) ?? 0}
          onPress={() => onSelect(item.day)}
        />
      )}
    />
  );
}

function DayChip({
  tripDay,
  isSelected,
  isToday,
  count,
  onPress,
}: {
  tripDay: TripDay;
  isSelected: boolean;
  isToday: boolean;
  count: number;
  onPress: () => void;
}) {
  const subtle = isSelected ? 'text-background/80' : 'text-muted-foreground';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`Day ${tripDay.day}, ${tripDay.label}, ${count === 1 ? '1 stop' : `${count} stops`}`}
      className={cn(
        'min-w-20 items-center gap-0.5 rounded-2xl border px-3 py-2',
        isSelected ? 'border-foreground bg-foreground' : 'border-border bg-card active:bg-accent',
      )}
    >
      <Text
        className={cn('text-xs font-medium', subtle, isToday && !isSelected && 'text-blue-600')}
      >
        {isToday ? 'Today' : tripDay.weekday}
      </Text>
      <Text className={cn('font-semibold', isSelected && 'text-background')}>
        Day {tripDay.day}
      </Text>
      <Text className={cn('text-xs', subtle)}>{tripDay.label}</Text>
      <View className="h-1.5 flex-row gap-0.5">
        {Array.from({ length: Math.min(count, 5) }, (_, index) => (
          <View
            key={index}
            className={cn('size-1.5 rounded-full', isSelected ? 'bg-background' : 'bg-blue-600')}
          />
        ))}
      </View>
    </Pressable>
  );
}
