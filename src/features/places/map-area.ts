import type { Region } from 'react-native-maps';
import type { SearchArea } from './trip-places';

// Converts between the map's visible region (a centre plus how many degrees are visible) and
// a search area (a centre plus a radius in metres). One degree of latitude is about 111 km;
// a degree of longitude gets narrower away from the equator.
const METERS_PER_DEGREE = 111_000;
// Google searches at most 50 km around a point
const MAX_RADIUS_METERS = 50_000;
// Fewer places than this and the screens offer a wider search
export const FEW_PLACES = 5;

// The same area with twice the radius, or null when it's already as wide as Google allows.
// For small towns, where the first search finds only a few places.
export function widerSearchArea(area: SearchArea): SearchArea | null {
  if (area.radiusMeters >= MAX_RADIUS_METERS) return null;
  return {
    center: area.center,
    radiusMeters: Math.min(area.radiusMeters * 2, MAX_RADIUS_METERS),
  };
}

function metersPerLongitudeDegree(latitude: number): number {
  return METERS_PER_DEGREE * Math.cos((latitude * Math.PI) / 180);
}

// The map opens on a square as wide as the search radius: the busy middle of the circle, where
// most results are, so pins don't pile up. Phones are taller than wide, so the width decides
// the zoom.
export function areaToRegion({ center, radiusMeters }: SearchArea): Region {
  return {
    ...center,
    latitudeDelta: radiusMeters / METERS_PER_DEGREE,
    longitudeDelta: radiusMeters / metersPerLongitudeDegree(center.latitude),
  };
}

// The reverse: a search radius equal to the visible map's width
export function regionToArea(region: Region): SearchArea {
  return {
    center: { latitude: region.latitude, longitude: region.longitude },
    radiusMeters: Math.round(region.longitudeDelta * metersPerLongitudeDegree(region.latitude)),
  };
}

// Whether the user has panned or zoomed far enough from the searched area that a new search
// would show different places (decides when "Search this area" appears)
export function hasMovedAway(searched: SearchArea, visible: SearchArea): boolean {
  const { center: a } = searched;
  const { center: b } = visible;
  const metersNorth = (b.latitude - a.latitude) * METERS_PER_DEGREE;
  const metersEast = (b.longitude - a.longitude) * metersPerLongitudeDegree(a.latitude);
  const moved = Math.hypot(metersNorth, metersEast);
  const zoomRatio = visible.radiusMeters / searched.radiusMeters;
  return moved > searched.radiusMeters * 0.3 || zoomRatio > 1.6 || zoomRatio < 0.6;
}
