import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { DayBookings } from '@/features/bookings';
import { savedPlaceDetailsHref } from '@/features/places';
import { NoTripState, todayDayNumber, tripDays, type TripDay } from '@/features/trips';
import { formatDateRange } from '@/lib/dates';
import { openRouteDirections } from '@/lib/directions';
import { formatDistance, formatMinutes, routeWalkEstimate } from '@/lib/geo';
import { useToday } from '@/lib/use-today';
import { useRouter } from 'expo-router';
import { MapIcon, NavigationIcon, PlusIcon } from 'lucide-react-native';
import { Fragment, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DayPicker } from './components/day-picker';
import { NextStopCard } from './components/next-stop-card';
import { StopRow } from './components/stop-row';
import { WalkLeg } from './components/walk-leg';
import { useItinerary, useItineraryActions, type Stop } from './use-itinerary';

// The plan tab: the trip day by day. Pick a day at the top, then see its stops in order (saved
// sights and sweet spots), with a rough walk between each two. On the trip's current day, the
// next stop not done yet sits on top with Directions and Done. Under the stops: add more saved
// places, show the day as a route on the map, or walk it in Google Maps.
export function PlanScreen() {
  const router = useRouter();
  const { trip, stops } = useItinerary();
  const actions = useItineraryActions(trip?._id);
  // The day tapped; null until then
  const [chosenDay, setChosenDay] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const todayDate = useToday();

  if (trip === undefined) {
    return <ActivityIndicator className="flex-1 bg-background" />;
  }
  if (trip === null) {
    return (
      <View className="flex-1 justify-center bg-background p-6">
        <NoTripState message="Pick a city, save places to visit and sweet spots, then plan your days here." />
      </View>
    );
  }

  const days = tripDays(trip.startDate, trip.endDate);
  const today = todayDayNumber(trip.startDate, trip.endDate, todayDate);
  // The day shown: the one tapped, otherwise today while the trip is on, otherwise the first.
  // A day tapped on another trip may not exist on this one.
  const day = chosenDay !== null && chosenDay <= days.length ? chosenDay : (today ?? 1);
  const tripDay = days[day - 1];
  if (tripDay === undefined) return null;
  const dayStops = (stops ?? []).filter((stop) => stop.day === day);

  // The place's details sheet, from the side it was saved on
  function openStop({ place }: Stop) {
    const href = savedPlaceDetailsHref(place);
    if (href) router.push(href);
  }

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerClassName="gap-4 pb-12">
          <View className="gap-1 px-4 pt-4">
            <Text variant="h3">Your plan</Text>
            <Text variant="muted">
              {trip.name} · {formatDateRange(trip.startDate, trip.endDate)}
            </Text>
          </View>
          <DayPicker
            days={days}
            selected={day}
            today={today}
            stopCounts={countByDay(stops ?? [])}
            onSelect={(next) => {
              setChosenDay(next);
              setIsEditing(false);
            }}
          />
          <View className="gap-3 px-4">
            {day === today && dayStops.length > 0 ? (
              <NextStopCard stops={dayStops} onDone={actions.toggleDone} />
            ) : null}
            <DayHeading
              tripDay={tripDay}
              stops={dayStops}
              isEditing={isEditing}
              onToggleEditing={() => setIsEditing(!isEditing)}
            />
            <DayBookings tripId={trip._id} date={tripDay.date} />
            {stops === undefined ? (
              <ActivityIndicator className="py-6" />
            ) : dayStops.length === 0 ? (
              <EmptyDay day={day} />
            ) : (
              <StopList
                stops={dayStops}
                isEditing={isEditing}
                actions={actions}
                onOpen={openStop}
              />
            )}
            <DayActions
              stops={dayStops}
              onAdd={() => router.push({ pathname: '/add-stops', params: { day: String(day) } })}
              onShowOnMap={() =>
                router.navigate({ pathname: '/map', params: { day: String(day) } })
              }
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// How many stops each day has, for the dots under the day chips
function countByDay(stops: Stop[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const stop of stops) counts.set(stop.day, (counts.get(stop.day) ?? 0) + 1);
  return counts;
}

// "Day 2 · Tue 24 Nov" and "4 stops · ~3.2 km, 40 min walk", with Edit (to reorder or remove)
function DayHeading({
  tripDay,
  stops,
  isEditing,
  onToggleEditing,
}: {
  tripDay: TripDay;
  stops: Stop[];
  isEditing: boolean;
  onToggleEditing: () => void;
}) {
  const walk = routeWalkEstimate(stops.map((stop) => stop.place.coordinates));
  const count = stops.length === 1 ? '1 stop' : `${stops.length} stops`;
  return (
    <View className="flex-row items-end gap-2 pt-1">
      <View className="flex-1 gap-0.5">
        <Text variant="h4">
          Day {tripDay.day} · {tripDay.weekday} {tripDay.label}
        </Text>
        {stops.length > 0 ? (
          <Text variant="muted">
            {count}
            {stops.length > 1
              ? ` · ~${formatDistance(walk.meters)}, ${formatMinutes(walk.minutes)} walk`
              : ''}
          </Text>
        ) : null}
      </View>
      {stops.length > 0 ? (
        <Button variant="ghost" size="sm" onPress={onToggleEditing}>
          <Text className="font-semibold text-blue-600">{isEditing ? 'Done' : 'Edit'}</Text>
        </Button>
      ) : null}
    </View>
  );
}

// The day's stops in order, with the walk between each two
function StopList({
  stops,
  isEditing,
  actions,
  onOpen,
}: {
  stops: Stop[];
  isEditing: boolean;
  actions: ReturnType<typeof useItineraryActions>;
  onOpen: (stop: Stop) => void;
}) {
  return (
    <View>
      {stops.map((stop, index) => {
        const previous = stops[index - 1];
        return (
          <Fragment key={stop._id}>
            {previous ? (
              <WalkLeg from={previous.place.coordinates} to={stop.place.coordinates} />
            ) : null}
            <StopRow
              stop={stop}
              number={index + 1}
              isFirst={index === 0}
              isLast={index === stops.length - 1}
              isEditing={isEditing}
              onToggleDone={() => actions.toggleDone(stop)}
              onMove={(direction) => actions.move(stop, direction)}
              onRemove={() => actions.remove(stop)}
              onOpen={() => onOpen(stop)}
            />
          </Fragment>
        );
      })}
    </View>
  );
}

function EmptyDay({ day }: { day: number }) {
  return (
    <View className="items-center gap-1 rounded-2xl border border-dashed border-border p-6">
      <Text className="font-semibold">Nothing planned for day {day} yet</Text>
      <Text variant="muted" className="text-center">
        Add places you saved (sights and sweet spots), then walk them in order.
      </Text>
    </View>
  );
}

// Add saved places to the day; with stops, also show the day on the map and walk the stops not
// done yet in Google Maps
function DayActions({
  stops,
  onAdd,
  onShowOnMap,
}: {
  stops: Stop[];
  onAdd: () => void;
  onShowOnMap: () => void;
}) {
  const remaining = stops.filter((stop) => !stop.done);
  return (
    <View className="gap-2 pt-1">
      <Button variant="outline" onPress={onAdd}>
        <Icon as={PlusIcon} className="size-4" />
        <Text>Add places</Text>
      </Button>
      {stops.length > 0 ? (
        <View className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onPress={onShowOnMap}>
            <Icon as={MapIcon} className="size-4" />
            <Text>Show on map</Text>
          </Button>
          <Button
            className="flex-1 bg-blue-600 active:bg-blue-700"
            disabled={remaining.length === 0}
            onPress={() =>
              openRouteDirections(
                remaining.map(({ place }) => ({
                  name: place.name,
                  coordinates: place.coordinates,
                  providerPlaceId: place.providerPlaceId,
                })),
              )
            }
          >
            <Icon as={NavigationIcon} className="size-4 text-white" />
            <Text className="text-white">Start route</Text>
          </Button>
        </View>
      ) : null}
    </View>
  );
}
