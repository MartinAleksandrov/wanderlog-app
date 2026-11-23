import type { Doc } from '@convex/_generated/dataModel';
import type { SuggestedPlace } from '@convex/googlePlaces';
import type { Coordinates, PlaceKind } from '@convex/schema';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import type { Region } from 'react-native-maps';
import { layoutPins } from '../pin-layout';
import { PlacePin } from './place-pin';

// One pin to draw, with the place(s) behind it
export type Pin = {
  key: string;
  name: string;
  photoName?: string;
  category?: string;
  coordinates: Coordinates;
  // The trip's row when the place is saved to the trip (a solid pin)
  saved?: Doc<'places'>;
  // Google's suggestion for this place when it's in the searched area, with its rating,
  // description and photos. A saved place outside that area has none (see place-preview-card).
  suggestion?: SuggestedPlace;
};

type PinLayerProps = {
  pins: Pin[];
  region: Region;
  // The pin whose pop-up is open, if any
  selectedKey: string | null;
  onSelect: (key: string) => void;
  // Sights or sweet spots: the pins' colours
  kind: PlaceKind;
};

// All the pins on the map (rendered inside <MapView>). Works out for the current zoom how much
// room each pin has: photo and name, just the photo, or a small dot (pin-layout.ts).
export function PinLayer({ pins, region, selectedKey, onSelect, kind }: PinLayerProps) {
  // The map fills the screen's width
  const { width: mapWidth } = useWindowDimensions();
  const sizes = layoutPins(pins, region, mapWidth, selectedKey);

  const markers = new Map(
    pins.map((pin) => {
      const size = sizes.get(pin.key) ?? 'mini';
      const isSaved = pin.saved !== undefined;
      const isSelected = pin.key === selectedKey;
      // A new key when the look changes, so the pin is mounted again and gets drawn again
      const key = `${kind}:${pin.key}:${size}:${isSaved ? 'saved' : 'suggested'}:${isSelected ? 'open' : ''}`;
      return [key, { pin, size, isSaved, isSelected }];
    }),
  );
  const order = useAppendOnlyOrder([...markers.keys()]);

  return order.map((key) => {
    const marker = markers.get(key);
    if (marker === undefined) return null;
    const { pin } = marker;
    return (
      <PlacePin
        key={key}
        name={pin.name}
        photoName={pin.photoName}
        category={pin.category}
        coordinates={pin.coordinates}
        kind={kind}
        isSaved={marker.isSaved}
        isSelected={marker.isSelected}
        size={marker.size}
        onPress={() => onSelect(pin.key)}
      />
    );
  });
}

// The keys in the order they first appeared: kept ones stay where they were, new ones go last.
//
// Works around a bug in react-native-maps on Android (1.27, the version in Expo Go): a marker
// added anywhere but at the end of the map's children replaces the marker at that position in
// its internal list instead of being inserted. The replaced marker stays on the map but is
// forgotten, and later removals then take away the wrong pins (a trip place vanished after
// exploring another city). Removing from the middle works, so as long as every new marker goes
// last, the list stays right. The order on screen doesn't matter: zIndex decides which pin is
// on top.
//
// Remembering the order across renders is state that's adjusted while rendering when the keys
// change, the pattern React recommends for this; React redraws before anything reaches the
// screen.
function useAppendOnlyOrder(keys: string[]): string[] {
  const [order, setOrder] = useState(keys);
  const current = new Set(keys);
  const kept = order.filter((key) => current.has(key));
  const keptSet = new Set(kept);
  const next = [...kept, ...keys.filter((key) => !keptSet.has(key))];
  if (next.length !== order.length || next.some((key, index) => key !== order[index])) {
    setOrder(next);
  }
  return next;
}
