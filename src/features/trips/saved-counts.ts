import type { TripSummary } from './types';

// What a trip has saved, for the home screen: "4 places", "4 places · 2 sweet spots",
// "1 sweet spot · 3 restaurants". Sweet spots and restaurants are only mentioned once there are
// some; places are always mentioned unless something else is.
export function savedCounts({ placeCount, sweetCount, restaurantCount }: TripSummary): string {
  const places = placeCount === 1 ? '1 place' : `${placeCount} places`;
  const extras = [
    sweetCount === 0 ? null : sweetCount === 1 ? '1 sweet spot' : `${sweetCount} sweet spots`,
    restaurantCount === 0
      ? null
      : restaurantCount === 1
        ? '1 restaurant'
        : `${restaurantCount} restaurants`,
  ].filter((part) => part !== null);
  if (extras.length === 0) return places;
  return (placeCount === 0 ? extras : [places, ...extras]).join(' · ');
}
