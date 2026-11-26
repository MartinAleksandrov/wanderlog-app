import { PlacePhoto } from '@/components/place-photo';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PLACE_KINDS, PLACE_MODES, placeKindOf, type PlaceMode } from '@/features/places';
import { tripDays } from '@/features/trips';
import { cn } from '@/lib/utils';
import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckIcon, MapIcon, PlusIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useItinerary, useItineraryActions, type Stop } from './use-itinerary';

// The pop-up from the plan tab's "Add places" (a sheet route, src/app/add-stops.tsx, opened
// with ?day=2): every place saved to the trip, sights, sweet spots and restaurants in their own
// groups. Tap one to put it at the end of the day, tap again to take it off. "On day 1" shows
// where a place is planned already.
export function AddStopsSheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const { trip, stops } = useItinerary();
  const places = useQuery(api.places.listForTrip, trip ? { tripId: trip._id } : 'skip');
  const actions = useItineraryActions(trip?._id);

  if (trip === undefined || (trip && (places === undefined || stops === undefined))) {
    return <ActivityIndicator className="flex-1 bg-background" />;
  }
  const days = trip ? tripDays(trip.startDate, trip.endDate) : [];
  const day = Math.min(Math.max(Number(params.day) || 1, 1), Math.max(days.length, 1));
  const tripDay = days[day - 1];
  if (trip === null || tripDay === undefined) {
    return (
      <View className="flex-1 bg-background p-6">
        <Text variant="muted">Choose a trip first.</Text>
      </View>
    );
  }

  const planned = stops ?? [];
  // This day's stop for each place, to take it off again
  const onThisDay = new Map(
    planned.filter((stop) => stop.day === day).map((stop) => [stop.placeId, stop]),
  );
  const groups = PLACE_KINDS.map((kind) => ({
    mode: PLACE_MODES[kind],
    places: (places ?? []).filter((place) => placeKindOf(place) === kind),
  })).filter((group) => group.places.length > 0);

  function toggle(place: Doc<'places'>) {
    const stop = onThisDay.get(place._id);
    if (stop) actions.remove(stop);
    else actions.add(place._id, day, place.name);
  }

  return (
    // nestedScrollEnabled: without it, scrolling back up drags the sheet down and closes it
    // (see place-details-sheet.tsx)
    <ScrollView
      nestedScrollEnabled
      className="flex-1 bg-background"
      contentContainerClassName="gap-5 px-5 pt-3 pb-12"
    >
      {/* A handle, so the sheet looks draggable (the native one is iOS only) */}
      <View className="h-1 w-10 self-center rounded-full bg-border" />
      <View className="gap-1">
        <Text variant="h3">Add to day {day}</Text>
        <Text variant="muted">
          {tripDay.weekday} {tripDay.label} · tap a place to add it, tap again to take it off
        </Text>
      </View>

      {groups.length === 0 ? (
        <View className="items-center gap-3 rounded-2xl border border-dashed border-border p-6">
          <Text className="text-center font-semibold">No saved places yet</Text>
          <Text variant="muted" className="text-center">
            Save sights, sweet spots and restaurants on the map first, then plan them here.
          </Text>
          <Button variant="outline" onPress={() => router.navigate('/map')}>
            <Icon as={MapIcon} className="size-4" />
            <Text>Open the map</Text>
          </Button>
        </View>
      ) : (
        groups.map(({ mode, places: groupPlaces }) => (
          <View key={mode.kind} className="gap-2">
            <View className="flex-row items-center gap-2">
              <Icon as={mode.icon} className="size-4 text-muted-foreground" />
              <Text className="text-sm font-semibold text-muted-foreground uppercase">
                {mode.title}
              </Text>
            </View>
            {groupPlaces.map((place) => (
              <AddRow
                key={place._id}
                place={place}
                mode={mode}
                isAdded={onThisDay.has(place._id)}
                otherDays={daysOf(place._id, planned).filter((other) => other !== day)}
                onPress={() => toggle(place)}
              />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

// The days a place is planned on, in order
function daysOf(placeId: Id<'places'>, stops: Stop[]): number[] {
  return stops.filter((stop) => stop.placeId === placeId).map((stop) => stop.day);
}

function AddRow({
  place,
  mode,
  isAdded,
  otherDays,
  onPress,
}: {
  place: Doc<'places'>;
  mode: PlaceMode;
  isAdded: boolean;
  otherDays: number[];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isAdded }}
      className={cn(
        'flex-row items-center gap-3 rounded-2xl border p-2.5 active:bg-accent',
        isAdded ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40' : 'border-border bg-card',
      )}
    >
      <PlacePhoto
        photoName={place.photoName}
        category={place.category}
        width={200}
        className="size-12 rounded-xl"
      />
      <View className="flex-1 gap-0.5">
        <Text className="font-semibold" numberOfLines={1}>
          {place.name}
        </Text>
        <Text variant="muted" numberOfLines={1}>
          {[
            place.category ?? mode.label,
            otherDays.length > 0 ? `on day ${otherDays.join(', ')}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <View
        className={cn(
          'size-8 items-center justify-center rounded-full',
          isAdded ? 'bg-blue-600' : 'border border-border',
        )}
      >
        <Icon
          as={isAdded ? CheckIcon : PlusIcon}
          strokeWidth={isAdded ? 3 : 2}
          className={cn('size-4', isAdded ? 'text-white' : 'text-muted-foreground')}
        />
      </View>
    </Pressable>
  );
}
