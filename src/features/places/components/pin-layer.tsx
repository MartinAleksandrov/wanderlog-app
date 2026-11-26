import type { Doc } from '@convex/_generated/dataModel';
import type { SuggestedPlace } from '@convex/googlePlaces';
import type { Coordinates, PlaceKind } from '@convex/schema';
import { useRoute } from 'expo-router';
import { useNavigationState } from 'expo-router/react-navigation';
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
  // Sights, sweet spots or restaurants: the pins' colours
  kind: PlaceKind;
};

// All the pins on the map (rendered inside <MapView>). Works out for the current zoom how much
// room each pin has: photo and name, just the photo, or a small dot (pin-layout.ts).
export function PinLayer({ pins, region, selectedKey, onSelect, kind }: PinLayerProps) {
  // The map fills the screen's width
  const { width: mapWidth } = useWindowDimensions();
  const sizes = layoutPins(pins, region, mapWidth, selectedKey);

  const looks = pins.map((pin) => {
    const size = sizes.get(pin.key) ?? 'mini';
    const isSaved = pin.saved !== undefined;
    const isSelected = pin.key === selectedKey;
    // Changes whenever the pin's look does. The photo too: a saved place's pin starts with the
    // photo stored when it was saved and gets Google's fresh one when the search comes back (see
    // use-map-places.ts), and a pin only picks up a new photo when it's mounted again.
    const look = `${kind}:${pin.key}:${size}:${isSaved ? 'saved' : 'suggested'}:${isSelected ? 'open' : ''}:${pin.photoName ?? ''}`;
    return { pin, size, isSaved, isSelected, look };
  });
  const drawing = useRedrawWhenShown(looks.map(({ look }) => look));
  // A new key when the look changes (or the map comes back with changed pins), so the pin is
  // mounted again and gets drawn again
  const markers = new Map(looks.map((marker) => [`${drawing}:${marker.look}`, marker]));
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

// Pins mounted while the map tab is hidden come out blank: Android draws a pin into a picture
// once its photo has loaded (see place-pin.tsx), and a hidden map never lays its pins out on
// screen, so the picture is an empty white label with its tail in the wrong place. The map stays
// mounted on other tabs (see the tabs layout), and its pins change there: picking another side on
// the places tab, saving a place from the list. So when the map is shown again after a pin was
// added or changed while it was hidden (even if the pins are back as they were), this returns a
// new number for the pins' keys: every pin is mounted again and drawn now that it's on screen.
// Their photos are in the phone's memory by then, so that's quick. Pins only taken away while
// hidden don't count: the ones left were drawn on screen.
//
// "Shown" means the map is the tab picked in the tab bar. Not useIsFocused(): that's also false
// while the place details sheet is open over the map, and the map is still on screen behind it,
// drawing its pins as usual.
//
// The state only changes when the map hides, when a pin first changes while hidden, and when it's
// shown again, so zooming and panning (which change the looks all the time) cost nothing. It's
// adjusted while rendering (as in useAppendOnlyOrder): React renders again before anything
// reaches the screen.
function useRedrawWhenShown(looks: string[]): number {
  const route = useRoute();
  const isShown = useNavigationState((tabs) => tabs.routes[tabs.index]?.key === route.key);
  const [state, setState] = useState(() => ({
    drawing: 0,
    isShown,
    looksWhenHidden: new Set(looks),
    isStale: false,
  }));

  // Hidden: remember the pins it had
  if (!isShown && state.isShown) {
    setState({ ...state, isShown, looksWhenHidden: new Set(looks), isStale: false });
  }
  // Hidden, and a pin was added or changed: it's drawn blank
  else if (!isShown && !state.isStale && looks.some((look) => !state.looksWhenHidden.has(look))) {
    setState({ ...state, isStale: true });
  }
  // Shown again: draw them again if they changed meanwhile
  else if (isShown && !state.isShown) {
    const drawing = state.isStale ? state.drawing + 1 : state.drawing;
    setState({ ...state, isShown, drawing, isStale: false });
    return drawing;
  }
  return state.drawing;
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
