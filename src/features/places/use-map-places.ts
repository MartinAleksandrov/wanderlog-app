import type { Doc } from '@convex/_generated/dataModel';
import type { SuggestedPlace } from '@convex/googlePlaces';
import { useState, type RefObject } from 'react';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import type { Pin } from './components/pin-layer';
import { areaToRegion } from './map-area';
import { useTripPlaces } from './trip-places';
import { useExploreCity } from './use-explore-city';
import { usePlaceActions } from './use-place-actions';

// Where the map opens for someone without a trip: Europe
const NO_TRIP_REGION: Region = {
  latitude: 48,
  longitude: 10,
  latitudeDelta: 30,
  longitudeDelta: 30,
};

// What the map tab shows: the active trip's places, or, while exploring a city found with the
// search bar, that city's places. Pins are ready to draw; tapping one selects it, which opens
// its pop-up at the bottom (place-preview-card.tsx).
export function useMapPlaces(mapRef: RefObject<MapView | null>) {
  const { trip, area, saved, suggestions, searchArea } = useTripPlaces();
  const { add, confirmRemove } = usePlaceActions(trip?._id);
  const explore = useExploreCity(trip?._id ?? null, area, mapRef);
  const { exploring } = explore;
  const shown = exploring ? explore.suggestions : suggestions;
  // The pin whose pop-up is open. Remembered by key (the Google place ID), so the pop-up stays
  // with the place while it's added (orange to purple) or removed, and closes by itself when
  // the pin leaves the map.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const pins = toPins(saved ?? [], shown.data ?? []);

  return {
    // undefined while loading, null when the user has no trip
    trip,
    explore,
    // The orange pins' search: the explored city's, otherwise the trip's
    shown,
    shownArea: exploring?.area ?? area,
    searchShownArea: exploring ? explore.searchArea : searchArea,
    title: exploring ? `Exploring ${exploring.destination.name}` : (trip?.name ?? ''),
    initialRegion: area ? areaToRegion(area) : NO_TRIP_REGION,
    pins,
    selectedKey,
    selected: pins.find((pin) => pin.key === selectedKey),
    select: setSelectedKey,
    // The pop-up's buttons. Adding needs no confirmation (the pin turns purple at once and one
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
    ...saved.map((place) => ({
      key: place.providerPlaceId ?? place._id,
      name: place.name,
      photoName: place.photoName,
      category: place.category,
      coordinates: place.coordinates,
      saved: place,
      // Google's fresh rating, description and photos when the place is in the searched area
      suggestion: place.providerPlaceId ? suggestionById.get(place.providerPlaceId) : undefined,
    })),
    ...suggestions
      .filter((place) => !savedIds.has(place.providerPlaceId))
      .map((place) => ({
        key: place.providerPlaceId,
        name: place.name,
        photoName: place.photoName,
        category: place.category,
        coordinates: place.coordinates,
        suggestion: place,
      })),
  ];
}
