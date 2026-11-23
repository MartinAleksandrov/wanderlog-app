import { tripDays } from '@/features/trips';
import type { Destination } from '@/lib/directions';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';

// One planned stop, with its saved place (see convex/itinerary.ts)
export type RouteStop = FunctionReturnType<typeof api.itinerary.listForTrip>[number];

// One day of the trip's plan, drawn on the map as a route (opened with "Show on map" in the
// plan tab). `day` is null when the map shows places as usual.
export function useDayRoute(day: number | null) {
  const trip = useQuery(api.trips.active);
  const plan = useQuery(
    api.itinerary.listForTrip,
    trip && day !== null ? { tripId: trip._id } : 'skip',
  );
  return {
    tripDay: trip && day !== null ? tripDays(trip.startDate, trip.endDate)[day - 1] : undefined,
    stops: plan?.filter((stop) => stop.day === day) ?? [],
    isLoading: plan === undefined,
  };
}

// A stop as Google Maps directions want it
export function stopDestination({ place }: RouteStop): Destination {
  return {
    name: place.name,
    coordinates: place.coordinates,
    providerPlaceId: place.providerPlaceId,
  };
}
