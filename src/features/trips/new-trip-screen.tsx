import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { showError } from '@/lib/error-message';
import { api } from '@convex/_generated/api';
import type { DestinationSuggestion } from '@convex/googlePlaces';
import { useAction, useMutation } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPinIcon, PlaneTakeoffIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { DestinationResults } from './components/destination-results';
import { TripDatesField } from './components/trip-dates-field';
import { addDays, todayIsoDate } from '@/lib/dates';
import type { TripDates } from './trip-days';

// Optional route params: a city picked elsewhere (the map's search bar), so the pop-up opens
// with it already chosen. All three come together.
type NewTripParams = { placeId?: string; name?: string; region?: string };

// The "Choose your next trip" pop-up (a modal route): search a city with Google, pick dates,
// create the trip. The new trip becomes the active one and the map opens on it.
export function NewTripScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<NewTripParams>();
  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<DestinationSuggestion | null>(() =>
    params.placeId && params.name
      ? { placeId: params.placeId, name: params.name, region: params.region ?? '' }
      : null,
  );
  // Four days from today to start with
  const [dates, setDates] = useState<TripDates>(() => {
    const today = todayIsoDate();
    return { startDate: today, endDate: addDays(today, 3) };
  });
  const [isCreating, setIsCreating] = useState(false);

  const getDestinationDetails = useAction(api.googlePlaces.destinationDetails);
  const createTrip = useMutation(api.trips.create);

  async function create() {
    if (destination === null) return;
    setIsCreating(true);
    try {
      const details = await getDestinationDetails({ placeId: destination.placeId });
      await createTrip({
        destination: [destination.name, destination.region].filter(Boolean).join(', '),
        destinationCoordinates: details.coordinates,
        destinationPhotoName: details.photoName,
        ...dates,
      });
      // Closes this pop-up and switches to the map tab
      router.navigate('/map');
    } catch (error) {
      showError("Couldn't create the trip", error);
      setIsCreating(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-6 p-4 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-2">
        <Text className="text-sm font-medium">Where do you want to go?</Text>
        {destination ? (
          <View className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-3">
            <Icon as={MapPinIcon} className="text-orange-500" />
            <View className="flex-1">
              <Text className="font-semibold">{destination.name}</Text>
              {destination.region ? <Text variant="muted">{destination.region}</Text> : null}
            </View>
            <Button variant="ghost" size="sm" onPress={() => setDestination(null)}>
              <Text>Change</Text>
            </Button>
          </View>
        ) : (
          <>
            <Input
              placeholder="Search for a city, e.g. Lisbon"
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
            />
            <DestinationResults query={query} onSelect={setDestination} className="-mx-1" />
          </>
        )}
      </View>

      <TripDatesField value={dates} onChange={setDates} />

      <Button size="lg" disabled={destination === null || isCreating} onPress={() => void create()}>
        {isCreating ? <ActivityIndicator /> : <Icon as={PlaneTakeoffIcon} />}
        <Text>Create trip</Text>
      </Button>
    </ScrollView>
  );
}
