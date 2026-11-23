import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { TripDay } from '@/features/trips';
import { openRouteDirections } from '@/lib/directions';
import { formatDistance, formatMinutes, routeWalkEstimate } from '@/lib/geo';
import { NavigationIcon, RouteIcon, XIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { stopDestination, type RouteStop } from '../use-day-route';

type DayRouteCardProps = {
  tripDay: TripDay;
  stops: RouteStop[];
  onClose: () => void;
  // Opens the plan tab, for a day with nothing on it yet
  onPlanDay: () => void;
};

// At the top of the map while it shows a day's route: which day, how many stops and roughly how
// far, and a button that walks the stops not done yet in Google Maps. ✕ goes back to the places.
export function DayRouteCard({ tripDay, stops, onClose, onPlanDay }: DayRouteCardProps) {
  const walk = routeWalkEstimate(stops.map((stop) => stop.place.coordinates));
  const remaining = stops.filter((stop) => !stop.done);
  const startLabel =
    remaining.length === stops.length
      ? 'Start in Google Maps'
      : `Continue: ${remaining.length} left`;

  return (
    <View className="gap-3 rounded-3xl border border-border bg-background p-4 shadow-lg">
      <View className="flex-row items-center gap-3">
        <View className="size-11 items-center justify-center rounded-2xl bg-blue-600">
          <Icon as={RouteIcon} className="size-5 text-white" />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-semibold">
            Day {tripDay.day} · {tripDay.weekday} {tripDay.label}
          </Text>
          <Text variant="muted">
            {stops.length === 1 ? '1 stop' : `${stops.length} stops`}
            {stops.length > 1
              ? ` · ~${formatDistance(walk.meters)}, ${formatMinutes(walk.minutes)} walk`
              : ''}
          </Text>
        </View>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Close the route"
          onPress={onClose}
        >
          <Icon as={XIcon} className="text-muted-foreground" />
        </Button>
      </View>
      {stops.length === 0 ? (
        <Button variant="outline" onPress={onPlanDay}>
          <Text>Nothing planned yet · Plan this day</Text>
        </Button>
      ) : (
        <Button
          className="bg-blue-600 active:bg-blue-700"
          disabled={remaining.length === 0}
          onPress={() => openRouteDirections(remaining.map(stopDestination))}
        >
          <Icon as={NavigationIcon} className="size-4 text-white" />
          <Text className="text-white">
            {remaining.length === 0 ? 'All stops done' : startLabel}
          </Text>
        </Button>
      )}
    </View>
  );
}
