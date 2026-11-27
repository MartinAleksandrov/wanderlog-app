import type { Coordinates } from '@convex/schema';
import type { Region } from 'react-native-maps';
import type { SearchArea } from './trip-places';

// Converts between the map's visible region (a centre plus how many degrees are visible) and
// a search area (a centre plus a width and height in metres). One degree of latitude is about
// 111 km; a degree of longitude gets narrower away from the equator.
const METERS_PER_DEGREE = 111_000;
// How wide "Search wider" goes at most: wider than that, 30 places spread too thin to help, and
// the backend shrinks areas much bigger than this anyway (Google's circles are at most 50 km)
const MAX_WIDTH_METERS = 50_000;
// How wide a city's first search is: enough to cover a city centre
const CITY_WIDTH_METERS = 5000;
// The map's shape on a phone, between the status bar and the tab bar: about twice as tall as wide.
// Fixed rather than measured, so the city's first search (and its cached answer) stays the same
// when the window changes size (split screen, a foldable).
const MAP_HEIGHT_PER_WIDTH = 2;
// How wide the map shows a single place picked in the search bar: its street and a few around it
const PLACE_WIDTH_METERS = 1200;
// Fewer places than this and the screens offer a wider search
export const FEW_PLACES = 5;

// The map region around a single place picked in the search bar, with the place in the middle
export function placeRegion(center: Coordinates): Region {
  return areaToRegion({
    center,
    widthMeters: PLACE_WIDTH_METERS,
    heightMeters: PLACE_WIDTH_METERS * MAP_HEIGHT_PER_WIDTH,
  });
}

// A city's first search area, the shape of the map, so its places cover the whole map when it
// opens there
export function cityArea(center: Coordinates): SearchArea {
  return {
    center,
    widthMeters: CITY_WIDTH_METERS,
    heightMeters: CITY_WIDTH_METERS * MAP_HEIGHT_PER_WIDTH,
  };
}

// The same area twice as wide and high, or null when it's already as wide as Google allows.
// For small towns, where the first search finds only a few places.
export function widerSearchArea(area: SearchArea): SearchArea | null {
  if (area.widthMeters >= MAX_WIDTH_METERS) return null;
  const scale = Math.min(2, MAX_WIDTH_METERS / area.widthMeters);
  return {
    center: area.center,
    widthMeters: Math.round(area.widthMeters * scale),
    heightMeters: Math.round(area.heightMeters * scale),
  };
}

function metersPerLongitudeDegree(latitude: number): number {
  return METERS_PER_DEGREE * Math.cos((latitude * Math.PI) / 180);
}

// The map region that shows exactly the search area
export function areaToRegion({ center, widthMeters, heightMeters }: SearchArea): Region {
  return {
    ...center,
    latitudeDelta: heightMeters / METERS_PER_DEGREE,
    longitudeDelta: widthMeters / metersPerLongitudeDegree(center.latitude),
  };
}

// The reverse: what the map shows right now, as a search area ("Search this area")
export function regionToArea(region: Region): SearchArea {
  return {
    center: { latitude: region.latitude, longitude: region.longitude },
    widthMeters: Math.round(region.longitudeDelta * metersPerLongitudeDegree(region.latitude)),
    heightMeters: Math.round(region.latitudeDelta * METERS_PER_DEGREE),
  };
}

// Whether the user has panned or zoomed far enough from the searched area that a new search
// would show different places (decides when "Search this area" appears). Places are found only
// inside the searched area, so a pan of a fifth of the screen already leaves an empty strip,
// zooming out leaves an empty frame, and zooming in leaves only some of the pins on screen.
export function hasMovedAway(searched: SearchArea, visible: SearchArea): boolean {
  const { center: a } = searched;
  const { center: b } = visible;
  const metersNorth = (b.latitude - a.latitude) * METERS_PER_DEGREE;
  const metersEast = (b.longitude - a.longitude) * metersPerLongitudeDegree(a.latitude);
  const zoomRatio = visible.widthMeters / searched.widthMeters;
  return (
    Math.abs(metersNorth) > searched.heightMeters * 0.2 ||
    Math.abs(metersEast) > searched.widthMeters * 0.2 ||
    zoomRatio > 1.3 ||
    zoomRatio < 0.7
  );
}
