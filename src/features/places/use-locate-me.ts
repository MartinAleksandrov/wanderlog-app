import { useMyLocation } from '@/lib/my-location';
import type { Coordinates } from '@convex/schema';
import * as Location from 'expo-location';
import { useRef, useState, type RefObject } from 'react';
import { Alert } from 'react-native';
import type MapView from 'react-native-maps';
import type { UserLocationChangeEvent } from 'react-native-maps';

// Close enough to see which street you're on: about 1 km across the screen
const STREET_ZOOM = 16;

// The map's "show me where I am" button: flies the map to Google's blue dot and zooms in on it.
//
// The dot is the exact spot: the map follows it with GPS (react-native-maps' default "high"
// priority), unlike the app's own location watch (my-location.tsx), which settles for about
// 100 m to save battery. So the button goes where the map last drew the dot. Right after the
// location is allowed, the dot isn't drawn yet; then the phone is asked for a fresh GPS fix
// (a few seconds, so the button spins meanwhile).
//
// Without permission yet, the first tap asks for it, and flies there once it's allowed.
export function useLocateMe(mapRef: RefObject<MapView | null>) {
  const location = useMyLocation();
  // Where the dot is. A ref, not state: the map reports it every few seconds, and nothing on
  // screen needs to redraw for it.
  const dot = useRef<Coordinates | null>(null);
  const [isLocating, setLocating] = useState(false);

  async function locate() {
    if (location.access !== 'granted' && (await location.enable()) !== 'granted') return;
    const target = dot.current ?? (await findMe());
    if (target) mapRef.current?.animateCamera({ center: target, zoom: STREET_ZOOM });
  }

  // A fresh GPS fix. With the phone's location switched off, Android first offers to turn it on.
  async function findMe(): Promise<Coordinates | null> {
    setLocating(true);
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    }).catch(() => null);
    setLocating(false);
    if (position === null) {
      Alert.alert("Can't find you", 'Turn on Location on your phone, then try again.');
      return null;
    }
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  }

  return {
    locate: () => void locate(),
    isLocating,
    // For the map's onUserLocationChange: remembers where the dot is
    onUserLocationChange: ({ nativeEvent }: UserLocationChangeEvent) => {
      const { coordinate } = nativeEvent;
      if (coordinate) {
        dot.current = { latitude: coordinate.latitude, longitude: coordinate.longitude };
      }
    },
  };
}
