import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { showError } from '@/lib/error-message';
import { useToday } from '@/lib/use-today';
import { useUser } from '@clerk/expo';
import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { PlusIcon } from 'lucide-react-native';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActiveTripCard } from './components/active-trip-card';
import { HomeBackgroundVideo } from './components/home-background-video';
import { NoTripState } from './components/no-trip-state';
import { TripRow } from './components/trip-row';
import type { TripSummary } from './types';

// The first tab: the trip you're planning now (big card), then your upcoming and previous
// trips. Tapping a trip in a list makes it the active one. A landmark video plays behind it all,
// so text that sits straight on the video is white; cards keep their own background.
export function HomeScreen() {
  const router = useRouter();
  const { user } = useUser();
  const trips = useQuery(api.trips.list);
  const activeTrip = useQuery(api.trips.active);
  // Optimistic: the tapped trip moves into the big card at once instead of after a server round
  // trip; Convex corrects it if the server answers differently
  const setActiveTrip = useMutation(api.trips.setActive).withOptimisticUpdate(
    (store, { tripId }) => {
      const tapped = store.getQuery(api.trips.list, {})?.find((t) => t._id === tripId);
      if (tapped) store.setQuery(api.trips.active, {}, tapped);
    },
  );
  const removeTrip = useMutation(api.trips.remove);
  const today = useToday();

  const current = trips?.find((trip) => trip._id === activeTrip?._id);
  const others = trips?.filter((trip) => trip._id !== current?._id) ?? [];
  // trips.list is latest-first; upcoming trips read better soonest-first
  const upcoming = others.filter((trip) => trip.endDate >= today).reverse();
  const previous = others.filter((trip) => trip.endDate < today);

  function confirmDelete(trip: TripSummary) {
    Alert.alert(
      `Delete ${trip.name}?`,
      "Its saved places, plan and bookings are deleted too. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void removeTrip({ tripId: trip._id }).catch((error: unknown) =>
              showError("Couldn't delete the trip", error),
            ),
        },
      ],
    );
  }

  function selectTrip(trip: TripSummary) {
    void setActiveTrip({ tripId: trip._id }).catch((error: unknown) =>
      showError("Couldn't open the trip", error),
    );
  }

  return (
    <View className="flex-1">
      <HomeBackgroundVideo />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerClassName="gap-6 p-4 pb-10">
          <View className="gap-1">
            <Text variant="muted" className="text-white/80">
              Hi {user?.firstName ?? 'traveller'} 👋
            </Text>
            <Text variant="h3" className="text-white">
              Where to next?
            </Text>
          </View>

          {trips === undefined ? (
            <ActivityIndicator className="py-10" color="white" />
          ) : current ? (
            <>
              <ActiveTripCard
                trip={current}
                today={today}
                onDelete={() => confirmDelete(current)}
              />
              <Button variant="outline" onPress={() => router.push('/new-trip')}>
                <Icon as={PlusIcon} />
                <Text>Choose your next trip</Text>
              </Button>
            </>
          ) : (
            <NoTripState
              className="border-solid bg-card"
              message="Pick a city and dates, and Wandr suggests the places worth visiting."
            />
          )}

          <TripList title="Current and upcoming" trips={upcoming} onSelect={selectTrip} />
          <TripList title="Previous trips" trips={previous} onSelect={selectTrip} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function TripList({
  title,
  trips,
  onSelect,
}: {
  title: string;
  trips: TripSummary[];
  onSelect: (trip: TripSummary) => void;
}) {
  if (trips.length === 0) return null;
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-white/80 uppercase">{title}</Text>
      {trips.map((trip) => (
        <TripRow key={trip._id} trip={trip} onPress={() => onSelect(trip)} />
      ))}
    </View>
  );
}
