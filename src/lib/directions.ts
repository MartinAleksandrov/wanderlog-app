import { openLink } from '@/lib/open-link';
import type { Coordinates } from '@convex/schema';

export type Destination = { name: string; coordinates: Coordinates; providerPlaceId?: string };

// Opens Google Maps with directions from where the phone is to the place: the route, how long
// it takes, and a Start button for turn-by-turn navigation. Walking first, since trip places are
// usually nearby; Google Maps lets the user switch to driving or transit. Without the Google
// Maps app it opens in the browser.
//
// A Google Maps URL (https://developers.google.com/maps/documentation/urls/get-started), so it
// needs no API key and costs nothing. With Google's place ID, the destination is the place's
// name plus that ID: Maps shows the name and routes to the place itself (its entrance). Without
// one, it's the bare coordinates.
export function openDirections({ name, coordinates, providerPlaceId }: Destination) {
  // Built by hand: React Native's URLSearchParams is only partly implemented
  const destination = providerPlaceId
    ? `destination=${encodeURIComponent(name)}&destination_place_id=${encodeURIComponent(providerPlaceId)}`
    : `destination=${coordinates.latitude},${coordinates.longitude}`;
  openLink(`https://www.google.com/maps/dir/?api=1&${destination}&travelmode=walking`);
}
