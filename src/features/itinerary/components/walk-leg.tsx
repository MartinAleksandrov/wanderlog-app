import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDistance, formatMinutes, walkEstimate } from '@/lib/geo';
import type { Coordinates } from '@convex/schema';
import { FootprintsIcon } from 'lucide-react-native';
import { View } from 'react-native';

// Between two stops: a short line down from the first stop's number and a rough walk,
// "~8 min · 650 m". Estimated on the phone (straight line plus a quarter for the streets), so
// it's free; Google Maps gives the real route.
export function WalkLeg({ from, to }: { from: Coordinates; to: Coordinates }) {
  const { meters, minutes } = walkEstimate(from, to);
  return (
    <View className="flex-row items-center gap-2 pl-6">
      <View className="h-7 w-0.5 rounded-full bg-border" />
      <Icon as={FootprintsIcon} className="size-3.5 text-muted-foreground" />
      <Text variant="muted" className="text-xs">
        ~{formatMinutes(minutes)} · {formatDistance(meters)}
      </Text>
    </View>
  );
}
