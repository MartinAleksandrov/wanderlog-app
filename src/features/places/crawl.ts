import { distanceMeters, routeWalkEstimate } from '@/lib/geo';
import type { Coordinates } from '@convex/schema';

// A saved sweet spot the crawl may visit
export type CrawlSpot = {
  key: string;
  name: string;
  coordinates: Coordinates;
  providerPlaceId?: string;
  rating?: number;
};

// The crawl: its stops in walking order, the walk between them, and (in the city) the walk from
// the phone to the first stop
export type Crawl = {
  stops: CrawlSpot[];
  walk: { meters: number; minutes: number };
  fromMe?: number;
};

const MIN_STOPS = 2;
const MAX_STOPS = 4;
// Spots further than this from the group's centre spot aren't one walk (straight line)
const MAX_SPREAD_METERS = 1500;
// Each star above 4.0 makes a spot count as this much closer: a 4.8 beats a 4.3 by 200 m, so
// the crawl takes a short detour for a much better spot, but not a long one
const RATING_BONUS_METERS = 400;
// For a spot whose rating isn't known (saved outside the searched area)
const USUAL_RATING = 4.3;

// The sweet-spot crawl: the best group of 3–4 saved spots close to each other (2 if that's all
// there is), in the order that walks the least. Every spot takes a turn as the group's centre,
// with its nearest neighbours within MAX_SPREAD_METERS. More stops win, then the shortest walk
// with better-rated spots counting as a bit closer. With `start` (the phone, in the city), the
// walk to the first stop counts too, so the crawl starts near you. null when no two spots are
// close enough.
export function planCrawl(spots: CrawlSpot[], start: Coordinates | null): Crawl | null {
  let best: { stops: CrawlSpot[]; cost: number } | null = null;
  for (const centre of spots) {
    const group = [centre, ...nearestTo(centre, spots)];
    if (group.length < MIN_STOPS) continue;
    const stops = shortestOrder(group, start);
    const cost = pathMeters(stops, start) - ratingBonus(group);
    const isBetter =
      best === null ||
      stops.length > best.stops.length ||
      (stops.length === best.stops.length && cost < best.cost);
    if (isBetter) best = { stops, cost };
  }
  if (best === null) return null;

  const first = best.stops[0];
  return {
    stops: best.stops,
    walk: routeWalkEstimate(best.stops.map((stop) => stop.coordinates)),
    // Straight line, like "350 m away" on the cards
    fromMe: start && first ? distanceMeters(start, first.coordinates) : undefined,
  };
}

// Up to MAX_STOPS - 1 other spots within reach of `centre`, nearest first
function nearestTo(centre: CrawlSpot, spots: CrawlSpot[]): CrawlSpot[] {
  return spots
    .filter((spot) => spot !== centre)
    .map((spot) => ({ spot, meters: distanceMeters(centre.coordinates, spot.coordinates) }))
    .filter(({ meters }) => meters <= MAX_SPREAD_METERS)
    .sort((a, b) => a.meters - b.meters)
    .slice(0, MAX_STOPS - 1)
    .map(({ spot }) => spot);
}

// Tries every order (at most 4! = 24) and keeps the shortest walk
function shortestOrder(group: CrawlSpot[], start: Coordinates | null): CrawlSpot[] {
  let best = group;
  let bestMeters = Infinity;
  for (const order of permutations(group)) {
    const meters = pathMeters(order, start);
    if (meters < bestMeters) {
      best = order;
      bestMeters = meters;
    }
  }
  return best;
}

// Straight-line metres from `start` (if any) through the stops in order
function pathMeters(stops: CrawlSpot[], start: Coordinates | null): number {
  const points = [...(start ? [start] : []), ...stops.map((stop) => stop.coordinates)];
  let meters = 0;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    if (from && to) meters += distanceMeters(from, to);
  }
  return meters;
}

function ratingBonus(group: CrawlSpot[]): number {
  return group.reduce(
    (bonus, spot) => bonus + ((spot.rating ?? USUAL_RATING) - 4) * RATING_BONUS_METERS,
    0,
  );
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}
