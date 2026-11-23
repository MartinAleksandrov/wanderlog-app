import { openLink } from '@/lib/open-link';
import type { Coordinates } from '@convex/schema';

export type Destination = { name: string; coordinates: Coordinates; providerPlaceId?: string };

// Google Maps URLs (https://developers.google.com/maps/documentation/urls/get-started) need no
// API key and cost nothing. Without the Google Maps app they open in the browser. Built by
// hand: React Native's URLSearchParams is only partly implemented.
const DIRECTIONS_URL = 'https://www.google.com/maps/dir/?api=1&travelmode=walking';
// The Google Maps app routes through at most 9 stops between the start and the destination
const MAX_WAYPOINTS = 9;
// "|", which separates stops in the URL
const SEPARATOR = '%7C';

// With Google's place ID, a stop is the place's name plus that ID: Maps shows the name and
// routes to the place itself (its entrance). Without one, it's the bare coordinates.
function stopValue(stop: Destination): string {
  return stop.providerPlaceId
    ? encodeURIComponent(stop.name)
    : `${stop.coordinates.latitude},${stop.coordinates.longitude}`;
}

// "&destination=…&destination_place_id=…", or the same for the origin
function placeParams(param: 'origin' | 'destination', stop: Destination): string {
  const id = stop.providerPlaceId
    ? `&${param}_place_id=${encodeURIComponent(stop.providerPlaceId)}`
    : '';
  return `&${param}=${stopValue(stop)}${id}`;
}

function destinationParams(stop: Destination): string {
  return placeParams('destination', stop);
}

// Directions from where the phone is to one place: the route, how long it takes, and a Start
// button for turn-by-turn navigation. Walking first, since trip places are usually nearby;
// Google Maps lets the user switch to driving or transit.
export function openDirections(destination: Destination) {
  openLink(`${DIRECTIONS_URL}${destinationParams(destination)}`);
}

// A walking route through stops in order (a day's plan, a sweet-spot crawl): the last stop is
// the destination, the others are stops on the way (up to 9, Google Maps' limit). It starts where
// the phone is, or with `startAtFirst`, at the first stop: for planning from home, where a route
// from the phone would begin in another country.
export function openRouteDirections(stops: Destination[], { startAtFirst = false } = {}) {
  const origin = startAtFirst ? stops[0] : undefined;
  const route = origin ? stops.slice(1) : stops;
  const last = route.at(-1);
  if (last === undefined) return;
  const onTheWay = route.slice(0, -1).slice(0, MAX_WAYPOINTS);
  let url = `${DIRECTIONS_URL}${origin ? placeParams('origin', origin) : ''}${destinationParams(last)}`;
  if (onTheWay.length > 0) {
    url += `&waypoints=${onTheWay.map(stopValue).join(SEPARATOR)}`;
    // Place IDs only work when every stop on the way has one, in the same order
    const ids = onTheWay.map((stop) => stop.providerPlaceId);
    if (ids.every(Boolean)) url += `&waypoint_place_ids=${ids.join(SEPARATOR)}`;
  }
  openLink(url);
}
