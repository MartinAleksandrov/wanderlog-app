import { useNow } from '@/lib/use-now';
import type { Doc } from '@convex/_generated/dataModel';
import type { PlaceSuggestion, SuggestedPlace } from '@convex/googlePlaces';
import { useState, type RefObject } from 'react';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import type { Pin } from './components/pin-layer';
import { areaToRegion, widerSearchArea } from './map-area';
import { isOpen, openStatus } from './open-status';
import { passesFilters, type FilterablePlace } from './place-filters';
import { usePlaceMode } from './place-mode-context';
import { useTripPlaces } from './trip-places';
import { useExploreCity } from './use-explore-city';
import { useMapSearch } from './use-map-search';
import { usePlaceActions } from './use-place-actions';

// Where the map opens for someone without a trip: Europe
const NO_TRIP_REGION: Region = {
  latitude: 48,
  longitude: 10,
  latitudeDelta: 30,
  longitudeDelta: 30,
};

// What the map tab shows: the active trip's places, or, while exploring a city found with the
// search bar, that city's places; sights, sweet spots or restaurants, whichever side is switched
// on. Words searched with the search bar ("coffee") show their places instead of either. Pins
// are ready to draw; tapping one selects it, which opens its pop-up at the bottom
// (place-preview-card.tsx).
export function useMapPlaces(mapRef: RefObject<MapView | null>) {
  const { trip, kind, area, saved, suggestions, searchArea } = useTripPlaces();
  const { add, confirmRemove } = usePlaceActions(trip?._id, kind);
  const explore = useExploreCity(trip?._id ?? null, area, mapRef);
  const search = useMapSearch(trip?._id ?? null, mapRef);
  const { exploring } = explore;
  const { textSearch } = search;
  const shown = textSearch ? search.results : exploring ? explore.suggestions : suggestions;
  const { filter, openNow } = usePlaceMode();
  const now = useNow();
  // The pin whose pop-up is open. Remembered by key (the Google place ID), so the pop-up stays
  // with the place while it's saved or removed, and closes by itself when the pin leaves the
  // map (or is filtered out).
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const allPins = toPins(saved ?? [], shown.data ?? []);
  // What the filters look at: the kind, and whether it's open (Google's hours come with the
  // suggestions; a saved place outside the searched area has none)
  const filterable = (pin: Pin): FilterablePlace => ({
    category: pin.category,
    isOpen: isOpen(openStatus(pin.suggestion?.hours, now)),
  });
  const filters = { filter, openNow };
  // The place picked in the search bar, while its pop-up is open: it keeps its pin wherever it
  // is and whatever the filters say. Closing the pop-up or tapping another pin removes the pin,
  // unless the place was saved (then it's one of the saved pins).
  const picked = search.picked?.providerPlaceId === selectedKey ? search.picked : null;
  const pins = allPins.filter(
    (pin) => pin.key === picked?.providerPlaceId || passesFilters(filterable(pin), filters),
  );
  if (picked && !pins.some((pin) => pin.key === picked.providerPlaceId)) {
    pins.push(suggestionPin(picked));
  }
  const shownArea = textSearch?.area ?? exploring?.area ?? area;
  const searchShownArea = textSearch
    ? search.searchTextArea
    : exploring
      ? explore.searchArea
      : searchArea;
  const widerArea = shownArea ? widerSearchArea(shownArea) : null;

  return {
    // undefined while loading, null when the user has no trip
    trip,
    kind,
    explore,
    search,
    // The pin of the place picked in the search bar, while its pop-up is open
    pickedKey: picked?.providerPlaceId ?? null,
    // Picking a place in the search bar: its pin opens once Google says where it is
    pickPlace: async (suggestion: PlaceSuggestion) => {
      const key = await search.pickPlace(suggestion);
      if (key !== null) setSelectedKey(key);
    },
    // The suggestion pins' search: the searched words', the explored city's, otherwise the trip's
    shown,
    shownArea,
    searchShownArea,
    // Few places found (a small town): offer the same search twice as wide and high, flying the
    // map out to show it. null once the search is as wide as Google allows.
    widerArea,
    searchWider: () => {
      if (widerArea === null) return;
      mapRef.current?.animateToRegion(areaToRegion(widerArea), 700);
      searchShownArea(widerArea);
    },
    title: textSearch
      ? `“${textSearch.query}”`
      : exploring
        ? `Exploring ${exploring.destination.name}`
        : (trip?.name ?? ''),
    initialRegion: area ? areaToRegion(area) : NO_TRIP_REGION,
    pins,
    // Every pin before filtering, to count the filter chips
    filterPlaces: allPins.map(filterable),
    filters,
    selectedKey,
    selected: pins.find((pin) => pin.key === selectedKey),
    select: setSelectedKey,
    // The pop-up's buttons. Adding needs no confirmation (the pin changes colour at once and one
    // tap undoes it); removing asks first, since the place may be planned on itinerary days.
    addPin: (pin: Pin) => {
      if (pin.suggestion) void add(pin.suggestion);
    },
    removePin: (pin: Pin) => {
      if (pin.saved) confirmRemove(pin.saved);
    },
  };
}

// The pins to draw: saved places first (so they get name labels before suggestions do), then
// the suggestions that aren't saved yet. A pin's key is the Google place ID, so a place keeps
// the same pin from suggestion to optimistic save to the server's real row.
function toPins(saved: Doc<'places'>[], suggestions: SuggestedPlace[]): Pin[] {
  const suggestionById = new Map(suggestions.map((place) => [place.providerPlaceId, place]));
  const savedIds = new Set(saved.map((place) => place.providerPlaceId));
  return [
    ...saved.map((place) => {
      // Google's fresh rating, description and photos when the place is in the searched area
      const suggestion = place.providerPlaceId
        ? suggestionById.get(place.providerPlaceId)
        : undefined;
      return {
        key: place.providerPlaceId ?? place._id,
        name: place.name,
        // Google's photo names expire, so the one stored when the place was saved can stop
        // working; the fresh one from the search is used whenever there is one (as the places
        // list does)
        photoName: suggestion?.photoName ?? place.photoName,
        category: place.category,
        coordinates: place.coordinates,
        saved: place,
        suggestion,
      };
    }),
    ...suggestions.filter((place) => !savedIds.has(place.providerPlaceId)).map(suggestionPin),
  ];
}

// The pin of a place that isn't saved
function suggestionPin(place: SuggestedPlace): Pin {
  return {
    key: place.providerPlaceId,
    name: place.name,
    photoName: place.photoName,
    category: place.category,
    coordinates: place.coordinates,
    suggestion: place,
  };
}
