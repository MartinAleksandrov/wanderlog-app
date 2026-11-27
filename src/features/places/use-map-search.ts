import { showError } from '@/lib/error-message';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { PlaceDetails, PlaceSuggestion } from '@convex/googlePlaces';
import { skipToken, useQuery as useCachedQuery, useQueryClient } from '@tanstack/react-query';
import { useAction } from 'convex/react';
import { useRef, useState, type RefObject } from 'react';
import { Keyboard } from 'react-native';
import type MapView from 'react-native-maps';
import { placeRegion } from './map-area';
import { usePlaceMode } from './place-mode-context';
import { isPlaceKind } from './place-modes';
import type { SearchArea } from './trip-places';

// Words searched on the map ("coffee") and the area they were searched in. Remembers which trip
// was active, like exploring a city does, so a new active trip ends it.
type TextSearch = { tripId: Id<'trips'> | null; query: string; area: SearchArea };

// The map's search bar beyond cities (those are explored, see use-explore-city.ts):
// - picking a single place (a café, a museum, an address) switches to that place's side, flies
//   the map to it and hands back its key, so the map can give it a pin and open its pop-up
// - searching words ("coffee", "sushi") shows every match in the area the map shows, instead of
//   the trip's or the explored city's suggestions, on the side most of them belong on
export function useMapSearch(tripId: Id<'trips'> | null, mapRef: RefObject<MapView | null>) {
  const queryClient = useQueryClient();
  const getPlaceDetails = useAction(api.googlePlaces.placeDetails);
  const searchText = useAction(api.googlePlaces.searchText);
  const { setKind } = usePlaceMode();
  // The place picked last, with everything the pop-up shows
  const [picked, setPicked] = useState<PlaceDetails | null>(null);
  const [search, setSearch] = useState<TextSearch | null>(null);
  // True while Google looks up a picked place or searches words, so the search bar can show a
  // spinner instead of looking frozen
  const [isBusy, setIsBusy] = useState(false);
  // Counts the lookups started. Only the newest one's answer is used: picking café A and then
  // museum B shows B even when A's answer arrives last, and only B's answer stops the spinner.
  const latest = useRef(0);
  const textSearch = search !== null && search.tripId === tripId ? search : null;

  // The same request and cache entry whether it's run on purpose (start) or by the map showing
  // it: searching "coffee" here again, or switching back to it, doesn't pay Google twice
  function textQuery({ query, area }: { query: string; area: SearchArea }) {
    const { center, widthMeters, heightMeters } = area;
    return {
      queryKey: [
        'text-search',
        query,
        center.latitude,
        center.longitude,
        widthMeters,
        heightMeters,
      ],
      queryFn: () => searchText({ query, area: { center, widthMeters, heightMeters } }),
      staleTime: Infinity,
    };
  }

  const shownQuery = textSearch ? textQuery(textSearch) : null;
  const results = useCachedQuery({
    queryKey: shownQuery?.queryKey ?? ['text-search'],
    queryFn: shownQuery?.queryFn ?? skipToken,
    staleTime: Infinity,
    select: (data) => data.places,
    // While "Search this area" loads, keep showing the same words' places from before
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === textSearch?.query ? previous : undefined,
  });

  // A new lookup: shows the spinner and returns its number, to check against `latest` later
  function begin(): number {
    Keyboard.dismiss();
    setIsBusy(true);
    latest.current += 1;
    return latest.current;
  }

  // Whether lookup `id` is still the newest. When it is, it's done, so the spinner stops.
  function finish(id: number): boolean {
    if (id !== latest.current) return false;
    setIsBusy(false);
    return true;
  }

  async function pickPlace(suggestion: PlaceSuggestion): Promise<string | null> {
    const id = begin();
    // No `finally`: the React Compiler can't optimize it yet, so both paths finish
    try {
      // The same request and cache key as the pop-up and the details sheet, so opening
      // "Details" next costs nothing more
      const place = await queryClient.fetchQuery({
        queryKey: ['place-details', suggestion.placeId],
        queryFn: () => getPlaceDetails({ placeId: suggestion.placeId }),
        staleTime: Infinity,
      });
      if (!finish(id)) return null;
      // A backend from before searched places existed sends no kind: the side then stays
      if (isPlaceKind(place.kind)) setKind(place.kind);
      setPicked(place);
      mapRef.current?.animateToRegion(placeRegion(place.coordinates), 700);
      return place.providerPlaceId;
    } catch (error) {
      if (finish(id)) showError(`Couldn't open ${suggestion.name}`, error);
      return null;
    }
  }

  // Searches the words on the area the map shows. The side switches once the places are known,
  // so the pins come up in the right colours straight away.
  async function startText(query: string, area: SearchArea) {
    const id = begin();
    try {
      const found = await queryClient.fetchQuery(textQuery({ query, area }));
      if (!finish(id)) return;
      if (found.kind) setKind(found.kind);
      setSearch({ tripId, query, area });
    } catch (error) {
      if (finish(id)) showError(`Couldn't search for “${query}”`, error);
    }
  }

  return {
    picked,
    pickPlace,
    // The words shown on the map, or null
    textSearch,
    // Their places, shaped like the suggestions they replace
    results,
    startText,
    // Back to the trip's or the explored city's places. A lookup still running is dropped too,
    // so its answer can't bring words back or fly the map away afterwards.
    stopText: () => {
      latest.current += 1;
      setIsBusy(false);
      setSearch(null);
    },
    // "Search this area" and "Search wider" while words are shown: the same words, there. The
    // side stays as it is.
    searchTextArea: (area: SearchArea) => {
      if (textSearch) setSearch({ ...textSearch, area });
    },
    isBusy,
  };
}
