import { Text } from '@/components/ui/text';
import type { TripDay } from '@/features/trips';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';
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
//
// The picked day scrolls to the middle: when the plan opens (today may be day 12, far off to the
// right) and when another day is picked. A day the list hasn't drawn yet can't be scrolled to
// directly (the list doesn't know where it is): onScrollToIndexFailed first jumps to about where
// it should be, which draws it, then tries again.
export function DayPicker({ days, selected, today, stopCounts, onSelect }: DayPickerProps) {
  const listRef = useRef<FlatList<TripDay>>(null);
  const index = selected - 1;
  const dayCount = days.length;

  useEffect(() => {
    if (index >= 0 && index < dayCount) {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.5 });
    }
  }, [index, dayCount]);

  return (
    <FlatList
      ref={listRef}
      horizontal
      data={days}
      keyExtractor={(tripDay) => String(tripDay.day)}
      // Re-render the chips when the selection or the stop counts change
      extraData={{ selected, stopCounts }}
      showsHorizontalScrollIndicator={false}
      className="grow-0"
      contentContainerClassName="gap-2 px-4"
      onScrollToIndexFailed={({ index: missed, averageItemLength }) => {
        listRef.current?.scrollToOffset({ offset: missed * averageItemLength, animated: false });
        setTimeout(() => {
          // Another trip with fewer days may have replaced the list meanwhile: scrolling past its
          // end throws, and the effect above already scrolls the new one
          try {
            listRef.current?.scrollToIndex({ index: missed, viewPosition: 0.5 });
          } catch {
            // nothing to do
          }
        }, 100);
      }}
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
