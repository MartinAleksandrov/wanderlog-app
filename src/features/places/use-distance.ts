import { distanceMeters } from '@/lib/geo';
import { useMyLocation } from '@/lib/my-location';
import type { Coordinates } from '@convex/schema';
import type { SearchArea } from './trip-places';

// How far outside the searched area the phone may be and still count as "in the city"
// (staying in a suburb, or a day trip nearby)
const NEAR_MARGIN_METERS = 20_000;

// How far a place is from the phone, in metres: for "350 m away" and listing places closest
// first. null when distances wouldn't help: no location, or the phone is far from the area shown.
// Planning from home, every place would be "1,900 km away", and closest first would mean nothing.
export function useDistanceTo(area: SearchArea | null): ((to: Coordinates) => number) | null {
  const { coords } = useMyLocation();
  if (coords === null || area === null) return null;
  // From the centre to a corner of the area, plus the margin
  const reach = Math.hypot(area.widthMeters, area.heightMeters) / 2 + NEAR_MARGIN_METERS;
  if (distanceMeters(coords, area.center) > reach) return null;
  return (to) => distanceMeters(coords, to);
}
