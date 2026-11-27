import type { Coordinates } from '@convex/schema';

const EARTH_RADIUS_M = 6_371_000;
// Streets aren't straight: a walk is about a quarter longer than the straight line
const DETOUR = 1.25;
// An easy city walking pace, about 4.8 km/h
const WALK_M_PER_MIN = 80;

// Straight-line distance between two points in metres (the haversine formula: distance on a
// sphere). Free and instant, unlike asking Google for a route.
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// A rough walk between two points, for the plan: "~8 min · 650 m". Rough on purpose; Google
// Maps gives the exact route when the user taps Directions.
export function walkEstimate(a: Coordinates, b: Coordinates): { meters: number; minutes: number } {
  return walkFromStraightLine(distanceMeters(a, b));
}

// The same rough walk from a straight-line distance already worked out, e.g. "350 m away"
export function walkFromStraightLine(straightMeters: number): { meters: number; minutes: number } {
  const meters = straightMeters * DETOUR;
  return { meters, minutes: Math.max(1, Math.round(meters / WALK_M_PER_MIN)) };
}

// The rough walk through several points in order, e.g. a day's stops
export function routeWalkEstimate(points: Coordinates[]): { meters: number; minutes: number } {
  let meters = 0;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    if (from && to) meters += walkEstimate(from, to).meters;
  }
  return { meters, minutes: Math.round(meters / WALK_M_PER_MIN) };
}

// "650 m", "3.2 km". Rounded before the unit is picked, so 996 m is "1.0 km", not "1000 m".
export function formatDistance(meters: number): string {
  const rounded = Math.round(meters / 10) * 10;
  return rounded < 1000 ? `${rounded} m` : `${(meters / 1000).toFixed(1)} km`;
}

// "8 min", "1 h 25 min"
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest === 0 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 60)} h ${rest} min`;
}
