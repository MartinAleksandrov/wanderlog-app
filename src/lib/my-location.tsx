import type { Coordinates } from '@convex/schema';
import * as Location from 'expo-location';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { AppState, Linking } from 'react-native';

// Whether the app may use the phone's location:
//   checking: not known yet (the first moment after launch)
//   granted:  yes, the position is followed while the app is open
//   ask:      not yet, or "no" once; the app may still ask
//   blocked:  "no" for good (Android stops showing the dialog); only the phone's settings can
//             change it, so the app doesn't keep asking
export type LocationAccess = 'checking' | 'granted' | 'ask' | 'blocked';

type MyLocation = {
  // Where the phone is, or null (no permission, location off, or not found yet)
  coords: Coordinates | null;
  access: LocationAccess;
  // Shows the system's "Allow Wandr to access this device's location?" dialog. Resolves to the
  // answer, so a button can carry on once it's allowed (the map's "show me where I am").
  enable: () => Promise<LocationAccess>;
};

const MyLocationContext = createContext<MyLocation | null>(null);

// A remembered position older than this may be from another city: wait for a fresh one instead
const MAX_LAST_KNOWN_AGE_MS = 10 * 60_000;

// Walking-pace updates: a new position after every 25 m. Without Google's "turn on Location
// Accuracy" dialog: Android would show it every time the app comes back while that setting is
// off, and the phone can find itself without it (see watchAccuracy).
async function startWatching(onPosition: (coords: Coordinates) => void) {
  return Location.watchPositionAsync(
    { accuracy: await watchAccuracy(), distanceInterval: 25, mayShowUserSettingsDialog: false },
    (position) => onPosition(toCoordinates(position)),
  );
}

// "Balanced" finds the phone from Wi-Fi and cell towers (about 100 m): plenty for "350 m away",
// and far lighter on the battery than GPS. But with Android's "Location Accuracy" off, those
// aren't available and balanced would never find the phone, so GPS it is.
async function watchAccuracy(): Promise<Location.Accuracy> {
  const status = await Location.getProviderStatusAsync();
  // networkAvailable is Android only; iOS picks its own sources
  return status.networkAvailable === false ? Location.Accuracy.High : Location.Accuracy.Balanced;
}

// Where the phone is, for "350 m away" on places and sorting them closest first. Lives in the
// tabs layout, so all tabs share one location watch.
//
// Only "while using the app" permission: the position is followed while the app is on screen
// and the watch stops when it goes to the background. Nothing asks for permission on its own:
// the places tab offers "Turn on" (see enable), so the system dialog never comes as a surprise.
export function MyLocationProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<LocationAccess>('checking');
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [isActive, setIsActive] = useState(AppState.currentState === 'active');

  // Follow the app going to the background and coming back
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setIsActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  // Check the permission at launch and whenever the app comes back: it may have been changed
  // in the phone's settings meanwhile
  useEffect(() => {
    if (!isActive) return;
    let isCancelled = false;
    Location.getForegroundPermissionsAsync()
      .then((response) => {
        if (!isCancelled) setAccess(accessOf(response));
      })
      .catch(() => {
        if (!isCancelled) setAccess('blocked');
      });
    return () => {
      isCancelled = true;
    };
  }, [isActive]);

  // Follow the phone while the app is open and allowed to
  useEffect(() => {
    if (!isActive || access !== 'granted') return;
    let isCancelled = false;
    let watch: Location.LocationSubscription | null = null;
    // A recent last known position shows distances at once; the watch then keeps them fresh. It
    // doesn't replace a position the watch already found (that one is newer).
    Location.getLastKnownPositionAsync({ maxAge: MAX_LAST_KNOWN_AGE_MS })
      .then((last) => {
        if (last && !isCancelled) setCoords((current) => current ?? toCoordinates(last));
      })
      .catch(() => undefined);
    startWatching(setCoords)
      .then((subscription) => {
        if (isCancelled) subscription.remove();
        else watch = subscription;
      })
      // Location is switched off on the phone: no distances, the app works as before
      .catch(() => undefined);
    return () => {
      isCancelled = true;
      watch?.remove();
    };
  }, [isActive, access]);

  // Ask for the permission, or, once Android no longer shows the dialog, open the app's page in
  // the phone's settings (coming back re-checks it, see above)
  async function enable(): Promise<LocationAccess> {
    try {
      const next = accessOf(await Location.requestForegroundPermissionsAsync());
      setAccess(next);
      if (next === 'blocked') void Linking.openSettings();
      return next;
    } catch {
      setAccess('blocked');
      return 'blocked';
    }
  }

  return (
    <MyLocationContext value={{ coords: access === 'granted' ? coords : null, access, enable }}>
      {children}
    </MyLocationContext>
  );
}

export function useMyLocation(): MyLocation {
  const context = use(MyLocationContext);
  if (context === null) throw new Error('useMyLocation needs a MyLocationProvider above it');
  return context;
}

function accessOf(response: Location.LocationPermissionResponse): LocationAccess {
  if (response.granted) return 'granted';
  return response.canAskAgain ? 'ask' : 'blocked';
}

function toCoordinates({ coords }: Location.LocationObject): Coordinates {
  return { latitude: coords.latitude, longitude: coords.longitude };
}
