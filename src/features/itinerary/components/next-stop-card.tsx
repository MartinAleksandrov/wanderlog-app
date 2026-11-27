import { PlacePhoto } from '@/components/place-photo';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { DirectionsButton } from '@/features/places';
import { distanceMeters, formatDistance, formatMinutes, walkFromStraightLine } from '@/lib/geo';
import { useMyLocation } from '@/lib/my-location';
import { CheckIcon, PartyPopperIcon } from 'lucide-react-native';
import { View } from 'react-native';
import type { Stop } from '../use-itinerary';

// Further than this, the phone isn't in the trip's city (yet): no "away" line
const NEAR_METERS = 50_000;
// Closer than this, you're there: the phone's location is only good to a few dozen metres
const HERE_METERS = 50;
// Longer than this, nobody walks it: just how far, without the minutes
const MAX_WALK_MINUTES = 60;

// Today's plan at a glance, for when you're out walking: the first stop not ticked off yet and
// how far away it is, with big Directions and "Been there" buttons. "Been there" ticks it off
// and moves on to the next one. Once every stop is done, a small celebration instead.
export function NextStopCard({
  stops,
  onDone,
}: {
  // Today's stops in order
  stops: Stop[];
  onDone: (stop: Stop) => void;
}) {
  const { coords } = useMyLocation();
  const index = stops.findIndex((stop) => !stop.done);
  const next = stops[index];

  if (next === undefined) {
    return (
      <View className="flex-row items-center gap-3 rounded-3xl bg-green-50 p-4 dark:bg-green-950/40">
        <Icon as={PartyPopperIcon} className="size-6 text-green-700 dark:text-green-300" />
        <Text className="flex-1 font-semibold text-green-800 dark:text-green-200">
          All stops done for today. Enjoy the evening!
        </Text>
      </View>
    );
  }

  const { place } = next;
  const away = coords ? distanceMeters(coords, place.coordinates) : null;
  return (
    <View className="gap-3 rounded-3xl bg-blue-50 p-4 dark:bg-blue-950/40">
      <Text className="text-xs font-semibold text-blue-700 uppercase dark:text-blue-300">
        Next stop · {index + 1} of {stops.length}
      </Text>
      <View className="flex-row items-center gap-3">
        <PlacePhoto
          photoName={place.photoName}
          category={place.category}
          width={240}
          className="size-16 rounded-2xl"
        />
        <View className="flex-1 gap-0.5">
          <Text className="text-lg leading-6 font-semibold" numberOfLines={2}>
            {place.name}
          </Text>
          {place.category ? <Text variant="muted">{place.category}</Text> : null}
          {away !== null && away < NEAR_METERS ? (
            <Text className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              {walkLine(away)}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="flex-row gap-2">
        <DirectionsButton
          withLabel
          destination={{
            name: place.name,
            coordinates: place.coordinates,
            providerPlaceId: place.providerPlaceId,
          }}
          className="h-10 flex-1"
        />
        {/* "Been there", not "Done": the plan's Edit button already turns into Done */}
        <Button variant="outline" className="flex-1 bg-background" onPress={() => onDone(next)}>
          <Icon as={CheckIcon} className="size-4" />
          <Text>Been there</Text>
        </Button>
      </View>
    </View>
  );
}

// How far the stop is from the phone, given the straight line: "~11 min walk · 850 m". A rough
// walk (the straight line plus a quarter for the streets), like the walks between the plan's
// stops, so it's close to what Google Maps shows after Directions; the straight line alone is
// about a quarter shorter than any real walk.
function walkLine(away: number): string {
  if (away < HERE_METERS) return "You're here";
  const walk = walkFromStraightLine(away);
  // The same walked distance as below, so the number never drops while walking away
  if (walk.minutes > MAX_WALK_MINUTES) return `~${formatDistance(walk.meters)} away`;
  return `~${formatMinutes(walk.minutes)} walk · ${formatDistance(walk.meters)}`;
}
