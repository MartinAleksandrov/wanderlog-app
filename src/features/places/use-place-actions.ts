import { showError } from '@/lib/error-message';
import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';
import type { SuggestedPlace } from '@convex/googlePlaces';
import type { PlaceKind } from '@convex/schema';
import type { OptimisticUpdate } from 'convex/browser';
import { useMutation } from 'convex/react';
import type { FunctionArgs } from 'convex/server';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { PLACE_MODES, placeKindOf } from './place-modes';

// Optimistic updates: the app changes its own copy of the saved places right away (the pin
// changes colour instantly) instead of waiting a server round trip, which took about 3 s on a slow
// network. Convex then replaces the guess with the real result, or undoes it if the server
// refuses (e.g. no permission), and the caller's catch shows why. They run when the mutation is
// called, never while rendering, so they live out here.

const addOptimistically: OptimisticUpdate<FunctionArgs<typeof api.places.add>> = (
  store,
  { tripId, kind, place },
) => {
  const saved = store.getQuery(api.places.listForTrip, { tripId });
  // Not loaded on this device yet, or already on this list: nothing to show early
  if (
    saved === undefined ||
    saved.some((p) => p.providerPlaceId === place.providerPlaceId && placeKindOf(p) === kind)
  ) {
    return;
  }
  const guess: Doc<'places'> = {
    // Stand-ins until the server answers with the real row
    _id: `optimistic-${kind}-${place.providerPlaceId}` as Id<'places'>,
    _creationTime: Date.now(),
    addedBy: 'optimistic' as Id<'users'>,
    tripId,
    kind,
    ...place,
  };
  // Newest first, like the real list
  store.setQuery(api.places.listForTrip, { tripId }, [guess, ...saved]);
};

const removeOptimistically: OptimisticUpdate<FunctionArgs<typeof api.places.remove>> = (
  store,
  { placeId },
) => {
  for (const { args, value } of store.getAllQueries(api.places.listForTrip)) {
    if (value === undefined) continue;
    store.setQuery(
      api.places.listForTrip,
      args,
      value.filter((p) => p._id !== placeId),
    );
  }
};

// Adding places to one of the trip's lists (places to visit, sweet spots or restaurants) and
// removing them (removing asks first). Shared by the map's pin pop-up, the places list and the
// details sheet, so all three behave the same.
export function usePlaceActions(tripId: Id<'trips'> | undefined, kind: PlaceKind) {
  const addPlace = useMutation(api.places.add).withOptimisticUpdate(addOptimistically);
  const removePlace = useMutation(api.places.remove).withOptimisticUpdate(removeOptimistically);

  async function add(place: SuggestedPlace) {
    if (tripId === undefined) return;
    // A light tap you can feel, as the pin changes colour
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // Only the fields the backend stores; rating and summary are looked up fresh from Google
      await addPlace({
        tripId,
        kind,
        place: {
          providerPlaceId: place.providerPlaceId,
          name: place.name,
          coordinates: place.coordinates,
          address: place.address,
          photoName: place.photoName,
          category: place.category,
        },
      });
    } catch (error) {
      showError(`Couldn't add ${place.name}`, error);
    }
  }

  function confirmRemove(place: Doc<'places'>) {
    // Saved a moment ago and the server hasn't confirmed yet: there's no real row to remove
    if (place._id.startsWith('optimistic-')) {
      Alert.alert('Still saving', `${place.name} is being saved. Try again in a moment.`);
      return;
    }
    const { listName } = PLACE_MODES[placeKindOf(place)];
    Alert.alert(`Remove ${place.name} from ${listName}?`, 'You can add it again later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          void removePlace({ placeId: place._id }).catch((error: unknown) =>
            showError(`Couldn't remove ${place.name}`, error),
          ),
      },
    ]);
  }

  return { add, confirmRemove };
}
