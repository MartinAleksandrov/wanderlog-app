import { showError } from '@/lib/error-message';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { DestinationSuggestion } from '@convex/googlePlaces';
import { useAction } from 'convex/react';
import { useRouter } from 'expo-router';
import { useState, type RefObject } from 'react';
import { Keyboard } from 'react-native';
import type MapView from 'react-native-maps';
import { areaToRegion } from './map-area';
import { usePlaceMode } from './place-mode-context';
import { DEFAULT_RADIUS_METERS, useNearbyPlaces, type SearchArea } from './trip-places';

// A city found with the map's search bar, shown instead of the trip's city. Remembers which
// trip was active, so creating a trip from it (which changes the active trip) ends the exploring.
type Exploration = {
  tripId: Id<'trips'> | null;
  destination: DestinationSuggestion;
  photoName?: string;
  area: SearchArea;
};

// Exploring other cities on the map: fly to a searched city and list its sights, go back to the
// trip, or turn the city into the next trip (the "Choose your next trip" pop-up, pre-filled).
export function useExploreCity(
  tripId: Id<'trips'> | null,
  tripArea: SearchArea | null,
  mapRef: RefObject<MapView | null>,
) {
  const router = useRouter();
  const getDestinationDetails = useAction(api.googlePlaces.destinationDetails);
  const [explore, setExplore] = useState<Exploration | null>(null);
  // True while finding out where a picked city is (about a second), so the search bar can show
  // a spinner instead of looking frozen
  const [isLocating, setIsLocating] = useState(false);
  const exploring = explore !== null && explore.tripId === tripId ? explore : null;
  // The explored city's sights or sweet spots, whichever side is switched on
  const { kind } = usePlaceMode();
  const suggestions = useNearbyPlaces(exploring?.area ?? null, 'explore', kind);

  async function start(destination: DestinationSuggestion) {
    Keyboard.dismiss();
    setIsLocating(true);
    // No `finally`: the React Compiler can't optimize it yet, so both paths reset the spinner
    try {
      const details = await getDestinationDetails({ placeId: destination.placeId });
      const area = { center: details.coordinates, radiusMeters: DEFAULT_RADIUS_METERS };
      setExplore({ tripId, destination, photoName: details.photoName, area });
      setIsLocating(false);
      mapRef.current?.animateToRegion(areaToRegion(area), 700);
    } catch (error) {
      setIsLocating(false);
      showError("Couldn't open this city", error);
    }
  }

  function stop() {
    setExplore(null);
    if (tripArea) mapRef.current?.animateToRegion(areaToRegion(tripArea), 700);
  }

  // Opens the "Choose your next trip" pop-up with the explored city already picked
  function planTrip() {
    if (exploring === null) return;
    const { placeId, name, region } = exploring.destination;
    router.push({ pathname: '/new-trip', params: { placeId, name, region } });
  }

  // "Search this area" while exploring
  function searchArea(area: SearchArea) {
    if (exploring) setExplore({ ...exploring, area });
  }

  return { exploring, isLocating, suggestions, start, stop, planTrip, searchArea };
}
