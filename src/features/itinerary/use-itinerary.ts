import { showError } from '@/lib/error-message';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { OptimisticLocalStore, OptimisticUpdate } from 'convex/browser';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import * as Haptics from 'expo-haptics';

// One planned stop: its place in the plan (day, order, done) plus the saved place itself
export type Stop = FunctionReturnType<typeof api.itinerary.listForTrip>[number];

// The active trip and its plan, live from Convex. Both are undefined while loading; trip is
// null when the user has none.
export function useItinerary() {
  const trip = useQuery(api.trips.active);
  const stops = useQuery(api.itinerary.listForTrip, trip ? { tripId: trip._id } : 'skip');
  return { trip, stops };
}

// Optimistic updates: the plan changes on screen at once and Convex then confirms it (or undoes
// it and the catch below says why), like saving places (see use-place-actions.ts).

function byDayAndOrder(a: Stop, b: Stop) {
  return a.day - b.day || a.order - b.order;
}

// Applies a change to every loaded copy of a plan (the change's arguments don't say which trip)
function updatePlans(store: OptimisticLocalStore, update: (stops: Stop[]) => Stop[]) {
  for (const { args, value } of store.getAllQueries(api.itinerary.listForTrip)) {
    if (value !== undefined) store.setQuery(api.itinerary.listForTrip, args, update(value));
  }
}

const addOptimistically: OptimisticUpdate<FunctionArgs<typeof api.itinerary.addPlace>> = (
  store,
  { tripId, day, placeId },
) => {
  const stops = store.getQuery(api.itinerary.listForTrip, { tripId });
  const place = store.getQuery(api.places.listForTrip, { tripId })?.find((p) => p._id === placeId);
  if (stops === undefined || place === undefined) return;
  const dayStops = stops.filter((stop) => stop.day === day);
  if (dayStops.some((stop) => stop.placeId === placeId)) return;
  const guess: Stop = {
    // Stand-ins until the server answers with the real row
    _id: `optimistic-${day}-${placeId}` as Id<'itineraryItems'>,
    _creationTime: Date.now(),
    tripId,
    day,
    order: Math.max(0, ...dayStops.map((stop) => stop.order)) + 1,
    kind: 'place',
    placeId,
    place,
  };
  store.setQuery(api.itinerary.listForTrip, { tripId }, [...stops, guess].sort(byDayAndOrder));
};

const removeOptimistically: OptimisticUpdate<FunctionArgs<typeof api.itinerary.removeItem>> = (
  store,
  { itemId },
) => updatePlans(store, (stops) => stops.filter((stop) => stop._id !== itemId));

const moveOptimistically: OptimisticUpdate<FunctionArgs<typeof api.itinerary.moveItem>> = (
  store,
  { itemId, direction },
) =>
  updatePlans(store, (stops) => {
    const item = stops.find((stop) => stop._id === itemId);
    if (item === undefined) return stops;
    const day = stops.filter((stop) => stop.day === item.day);
    const neighbour = day[day.indexOf(item) + (direction === 'up' ? -1 : 1)];
    if (neighbour === undefined) return stops;
    return stops
      .map((stop) => {
        if (stop._id === item._id) return { ...stop, order: neighbour.order };
        if (stop._id === neighbour._id) return { ...stop, order: item.order };
        return stop;
      })
      .sort(byDayAndOrder);
  });

const doneOptimistically: OptimisticUpdate<FunctionArgs<typeof api.itinerary.setDone>> = (
  store,
  { itemId, done },
) =>
  updatePlans(store, (stops) =>
    stops.map((stop) => (stop._id === itemId ? { ...stop, done } : stop)),
  );

// A stop added a moment ago that the server hasn't confirmed yet has no real ID to change
function isPending(stop: Stop): boolean {
  return stop._id.startsWith('optimistic-');
}

// Changing the plan: add a saved place to a day, take a stop off, move it up or down, tick it
// off. Ticking off a stop gives a little "done" buzz.
export function useItineraryActions(tripId: Id<'trips'> | undefined) {
  const addPlace = useMutation(api.itinerary.addPlace).withOptimisticUpdate(addOptimistically);
  const removeItem = useMutation(api.itinerary.removeItem).withOptimisticUpdate(
    removeOptimistically,
  );
  const moveItem = useMutation(api.itinerary.moveItem).withOptimisticUpdate(moveOptimistically);
  const setDone = useMutation(api.itinerary.setDone).withOptimisticUpdate(doneOptimistically);

  function add(placeId: Id<'places'>, day: number, name: string) {
    if (tripId === undefined) return;
    void addPlace({ tripId, day, placeId }).catch((error: unknown) =>
      showError(`Couldn't add ${name} to day ${day}`, error),
    );
  }

  function remove(stop: Stop) {
    if (isPending(stop)) return;
    void removeItem({ itemId: stop._id }).catch((error: unknown) =>
      showError(`Couldn't remove ${stop.place.name}`, error),
    );
  }

  function move(stop: Stop, direction: 'up' | 'down') {
    if (isPending(stop)) return;
    void moveItem({ itemId: stop._id, direction }).catch((error: unknown) =>
      showError(`Couldn't move ${stop.place.name}`, error),
    );
  }

  function toggleDone(stop: Stop) {
    if (isPending(stop)) return;
    if (!stop.done) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void setDone({ itemId: stop._id, done: !stop.done }).catch((error: unknown) =>
      showError(`Couldn't update ${stop.place.name}`, error),
    );
  }

  return { add, remove, move, toggleDone };
}
