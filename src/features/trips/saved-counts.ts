import type { TripSummary } from './types';

// What a trip has saved, for the home screen: "4 places", "4 places · 2 sweet spots",
// "1 sweet spot". Sweet spots are only mentioned once there are some.
export function savedCounts({ placeCount, sweetCount }: TripSummary): string {
  const places = placeCount === 1 ? '1 place' : `${placeCount} places`;
  if (sweetCount === 0) return places;
  const sweets = sweetCount === 1 ? '1 sweet spot' : `${sweetCount} sweet spots`;
  return placeCount === 0 ? sweets : `${places} · ${sweets}`;
}
