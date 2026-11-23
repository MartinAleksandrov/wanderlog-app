import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { Coordinates } from '@convex/schema';
import { skipToken, useQuery as useCachedQuery } from '@tanstack/react-query';
import { useAction, useQuery } from 'convex/react';
import { createContext, use, useState, type ReactNode } from 'react';

// Where to look for places: a circle on the map, remembered per trip
export type SearchArea = { center: Coordinates; radiusMeters: number };
type TripSearchArea = SearchArea & { tripId: Id<'trips'> };

// Big enough to cover a city centre
export const DEFAULT_RADIUS_METERS = 5000;

const SearchAreaContext = createContext<{
  area: TripSearchArea | null;
  setArea: (area: TripSearchArea) => void;
} | null>(null);

// Shares the search area between the map and places tabs, so "Search this area" on the map
// changes what both show. Lives in the tabs layout, above both screens.
export function SearchAreaProvider({ children }: { children: ReactNode }) {
  const [area, setArea] = useState<TripSearchArea | null>(null);
  return <SearchAreaContext value={{ area, setArea }}>{children}</SearchAreaContext>;
}

// Places to visit around an area, from Google through our backend. `scope` keeps separate
// lists apart (a trip's ID, or 'explore' for a city found with the map's search bar).
//
// TanStack Query caches the answer per area: screens showing the same area share one request,
// and going back to an earlier area doesn't pay Google again while the app is open.
export function useAttractions(area: SearchArea | null, scope: string | undefined) {
  const nearbyAttractions = useAction(api.googlePlaces.nearbyAttractions);

  return useCachedQuery({
    queryKey: [
      'attractions',
      scope,
      area?.center.latitude,
      area?.center.longitude,
      area?.radiusMeters,
    ],
    // Only the two fields the backend accepts (a remembered area also carries its tripId)
    queryFn: area
      ? () => nearbyAttractions({ center: area.center, radiusMeters: area.radiusMeters })
      : skipToken,
    staleTime: Infinity,
    // While a new area loads, keep showing the previous one's places, but only within the same
    // scope, so switching trips never flashes the other city's places
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === scope ? previous : undefined,
  });
}

// Everything the map and places tabs show for the active trip:
// - trip:        the active trip (undefined while loading, null when the user has none)
// - saved:       places saved to the trip, live from Convex (purple)
// - suggestions: places to visit in the search area, from Google (orange)
export function useTripPlaces() {
  const context = use(SearchAreaContext);
  if (context === null) throw new Error('useTripPlaces needs a SearchAreaProvider above it');

  const trip = useQuery(api.trips.active);
  const saved = useQuery(api.places.listForTrip, trip ? { tripId: trip._id } : 'skip');

  // The area last searched on the map while it belongs to this trip, otherwise the destination
  const area: SearchArea | null =
    trip && context.area?.tripId === trip._id
      ? context.area
      : trip?.destinationCoordinates
        ? { center: trip.destinationCoordinates, radiusMeters: DEFAULT_RADIUS_METERS }
        : null;

  const suggestions = useAttractions(area, trip?._id);

  function searchArea(next: SearchArea) {
    if (trip) context?.setArea({ ...next, tripId: trip._id });
  }

  return { trip, area, saved, suggestions, searchArea };
}
