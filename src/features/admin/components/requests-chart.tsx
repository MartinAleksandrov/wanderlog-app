import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatChartDay, formatNumber } from '../format';

// Google requests per day, one column per day, today on the right. A phone has no hover, so a
// tap on a column shows its number in the line above the chart (today's at first). The whole
// column's height is the tap target, so even a zero day is easy to hit.
export function RequestsChart({ days }: { days: { day: string; count: number }[] }) {
  const [selectedIndex, setSelectedIndex] = useState(days.length - 1);
  const selected = days[selectedIndex];
  // The busiest day reaches the top; 1 keeps a quiet week from dividing by zero
  const max = Math.max(1, ...days.map((day) => day.count));

  return (
    <View className="gap-3">
      {selected ? (
        <Text>
          <Text className="text-2xl font-semibold">{formatNumber(selected.count)}</Text>
          <Text variant="muted"> on {formatChartDay(selected.day, true)}</Text>
        </Text>
      ) : null}

      {/* The bars, standing on a baseline */}
      <View className="h-32 flex-row border-b border-border">
        {days.map((day, index) => (
          <Pressable
            key={day.day}
            onPress={() => setSelectedIndex(index)}
            className="h-full flex-1 items-center justify-end"
            accessibilityRole="button"
            accessibilityLabel={`${formatChartDay(day.day, true)}: ${formatNumber(day.count)} requests`}
            accessibilityState={{ selected: index === selectedIndex }}
          >
            {/* At most 24 dp wide, rounded only at the top (the value's end) */}
            <View
              className={cn(
                'w-6 rounded-t bg-blue-600 dark:bg-blue-500',
                index !== selectedIndex && 'opacity-50',
              )}
              style={{ height: `${(day.count / max) * 100}%` }}
            />
          </Pressable>
        ))}
      </View>

      <View className="flex-row">
        {days.map((day, index) => (
          <Text
            key={day.day}
            className={cn(
              'flex-1 text-center text-xs',
              index === selectedIndex ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            {formatChartDay(day.day)}
          </Text>
        ))}
      </View>
    </View>
  );
}
