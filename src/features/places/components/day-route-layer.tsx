import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { CheckIcon } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';
import { PLACE_MODES, placeKindOf } from '../place-modes';
import type { RouteStop } from '../use-day-route';

// The blue of Google Maps' route lines (Tailwind's blue-600); the map's line needs a plain colour
const ROUTE_BLUE = '#2563eb';

// A day's stops on the map: numbered circles in the plan's order (purple for sights, chocolate
// for sweet spots, teal for restaurants, green with a check once done), joined by a dashed line.
// The line is straight from stop to stop, as the crow flies: it shows the order, and Google Maps
// gives the streets.
//
// The parent gives this layer a new key whenever the stops change, so all its markers are added
// again at the end of the map's children (see useAppendOnlyOrder in pin-layer.tsx for why).
export function DayRouteLayer({
  stops,
  onPressStop,
}: {
  stops: RouteStop[];
  onPressStop: (stop: RouteStop) => void;
}) {
  return (
    <>
      {stops.map((stop, index) => (
        <StopMarker
          key={stop._id}
          stop={stop}
          number={index + 1}
          onPress={() => onPressStop(stop)}
        />
      ))}
      {stops.length > 1 ? (
        <Polyline
          coordinates={stops.map((stop) => stop.place.coordinates)}
          strokeColor={ROUTE_BLUE}
          strokeWidth={4}
          lineDashPattern={[12, 8]}
        />
      ) : null}
    </>
  );
}

function StopMarker({
  stop,
  number,
  onPress,
}: {
  stop: RouteStop;
  number: number;
  onPress: () => void;
}) {
  // Drawn once laid out, then no more redrawing (see place-pin.tsx)
  const [isLaidOut, setIsLaidOut] = useState(false);
  const look = PLACE_MODES[placeKindOf(stop.place)].pins.saved;

  return (
    <Marker
      coordinate={stop.place.coordinates}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={!isLaidOut}
      zIndex={number}
      onPress={onPress}
      accessibilityLabel={`${number}. ${stop.place.name}`}
    >
      <View
        onLayout={() => setIsLaidOut(true)}
        className={cn(
          'size-9 items-center justify-center rounded-full border-[3px] border-white',
          stop.done ? 'bg-green-600' : look.dot,
        )}
      >
        {stop.done ? (
          <Icon as={CheckIcon} strokeWidth={3} className="size-4 text-white" />
        ) : (
          <Text className="text-sm font-bold text-white">{number}</Text>
        )}
      </View>
    </Marker>
  );
}
