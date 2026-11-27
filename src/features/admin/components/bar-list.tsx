import { Text } from '@/components/ui/text';
import { View } from 'react-native';
import { formatNumber } from '../format';

// Ranked horizontal bars: a name and a number per row with a bar under them, largest first, all
// in one colour. For comparing parts with each other (requests by kind, phone models): bars on
// one baseline compare more exactly than slices of a pie. The colour carries no meaning of its
// own, so names and numbers are in the normal text colours.
export function BarList({ rows }: { rows: { name: string; count: number }[] }) {
  // The longest bar fills the row; 1 keeps an all-zero list from dividing by zero
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <View className="gap-3">
      {rows.map((row) => (
        <View
          key={row.name}
          className="gap-1.5"
          accessible
          accessibilityLabel={`${row.name}: ${formatNumber(row.count)}`}
        >
          <View className="flex-row justify-between gap-3">
            <Text className="flex-1 text-sm" numberOfLines={1}>
              {row.name}
            </Text>
            <Text className="text-sm font-medium">{formatNumber(row.count)}</Text>
          </View>
          {/* Square where it starts, rounded where the value ends; nothing drawn for zero */}
          <View
            className="h-2 rounded-r bg-blue-600 dark:bg-blue-500"
            style={{ width: `${(row.count / max) * 100}%` }}
          />
        </View>
      ))}
    </View>
  );
}
