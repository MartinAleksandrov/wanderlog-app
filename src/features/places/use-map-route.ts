import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useEffectEvent, type RefObject } from 'react';
import type MapView from 'react-native-maps';
import { savedPlaceDetailsHref } from './place-details-href';
import { useDayRoute, type RouteStop } from './use-day-route';

// Room around a fitted route: the route card at the top, the tab bar and logo at the bottom
const EDGE_PADDING = { top: 300, right: 70, bottom: 140, left: 70 };
// How close the map zooms in on a day with a single stop
const SINGLE_STOP_DELTA = 0.01;

// The map's route mode: the plan tab opens the map with ?day=2, and the map then shows that
// day's stops as a numbered route instead of the places (see DayRouteLayer and DayRouteCard).
// Entering it closes any open pin pop-up and fits the map around the stops; ✕ goes back.
export function useMapRoute(mapRef: RefObject<MapView | null>, onEnter: () => void) {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const parsed = Number(params.day);
  const day = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  const route = useDayRoute(day);
  const stopIds = route.stops.map((stop) => stop._id).join(',');

  // Reads the latest stops without making them a reason to fit again
  const fitToStops = useEffectEvent(() => {
    onEnter();
    const coordinates = route.stops.map((stop) => stop.place.coordinates);
    const [only] = coordinates;
    if (coordinates.length === 1 && only) {
      mapRef.current?.animateToRegion(
        { ...only, latitudeDelta: SINGLE_STOP_DELTA, longitudeDelta: SINGLE_STOP_DELTA },
        600,
      );
    } else if (coordinates.length > 1) {
      mapRef.current?.fitToCoordinates(coordinates, { edgePadding: EDGE_PADDING, animated: true });
    }
  });

  // On entering route mode, and when the day's stops change
  useEffect(() => {
    if (day !== null) fitToStops();
  }, [day, stopIds]);

  return {
    // Set while the map shows a route; undefined otherwise (or while loading)
    tripDay: route.tripDay,
    stops: route.stops,
    // Changes whenever a stop is added, moved or ticked off, so the route's markers are all
    // drawn again (see DayRouteLayer)
    layerKey: route.stops.map((stop) => `${stop._id}:${stop.done ? 1 : 0}`).join(','),
    close: () => router.setParams({ day: undefined }),
    planDay: () => router.navigate('/plan'),
    // Tapping a stop opens its details sheet
    openStop: ({ place }: RouteStop) => {
      const href = savedPlaceDetailsHref(place);
      if (href) router.push(href);
    },
  };
}
