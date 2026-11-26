import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { showError } from '@/lib/error-message';
import { api } from '@convex/_generated/api';
import { TRIP_MAX_DAYS, TRIP_NAME_MAX_LENGTH, TRIP_NOTES_MAX_LENGTH } from '@convex/lib/limits';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { TripDatesField } from './components/trip-dates-field';
import { daysBetween, formatDate } from '@/lib/dates';
import type { TripDates } from './trip-days';

type Trip = NonNullable<FunctionReturnType<typeof api.trips.get>>;
type Stop = FunctionReturnType<typeof api.itinerary.listForTrip>[number];

// The "Edit trip" pop-up (a modal route, /edit-trip/<trip ID>): the trip's name, dates and notes.
// Waits for the trip and its plan, then shows the form filled in with them.
export function EditTripScreen() {
  // A plain string from the URL; trips.get checks that it's a trip ID
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const trip = useQuery(api.trips.get, { tripId });
  // 'skip': no request until the trip is found, then with its checked ID
  const stops = useQuery(api.itinerary.listForTrip, trip ? { tripId: trip._id } : 'skip');

  if (trip === null) return <Message text="This trip no longer exists." />;
  // The edit button is hidden for viewers; this covers a link, or a role changed meanwhile
  if (trip?.role === 'viewer') return <Message text="You can see this trip, but not change it." />;
  if (trip === undefined || stops === undefined) {
    return <ActivityIndicator className="flex-1 bg-background" />;
  }
  return <EditTripForm initialTrip={trip} stops={stops} />;
}

function Message({ text }: { text: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text variant="muted">{text}</Text>
    </View>
  );
}

// A separate component so the form's state can start from the loaded trip. Only the start: later
// changes to the trip (someone else editing it) don't overwrite what the user is typing.
function EditTripForm({ initialTrip, stops }: { initialTrip: Trip; stops: Stop[] }) {
  const router = useRouter();
  const [name, setName] = useState(initialTrip.name);
  const [dates, setDates] = useState<TripDates>({
    startDate: initialTrip.startDate,
    endDate: initialTrip.endDate,
  });
  const [notes, setNotes] = useState(initialTrip.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const updateTrip = useMutation(api.trips.update);

  const { startDate, endDate } = dates;
  const days = daysBetween(startDate, endDate) + 1;
  // Stops on days the new dates no longer have; the backend moves them to the last day
  const cutStops = stops.filter((stop) => stop.day > days).length;
  // Only a trip saved before the length limit can be longer; the dates field says so
  const isTooLong = days > TRIP_MAX_DAYS;

  // A promise chain, not try/finally: React Compiler can't compile a `finally` block yet
  function save() {
    setIsSaving(true);
    void updateTrip({ tripId: initialTrip._id, name, startDate, endDate, notes })
      .then(() => router.back())
      .catch((error: unknown) => showError("Couldn't save the trip", error))
      // After router.back() the screen is closing; React ignores the update then
      .finally(() => setIsSaving(false));
  }

  function confirmSave() {
    if (cutStops === 0) {
      save();
      return;
    }
    const what =
      cutStops === 1
        ? '1 planned stop is on a day the trip no longer has. It moves'
        : `${cutStops} planned stops are on days the trip no longer has. They move`;
    Alert.alert('Shorten the trip?', `${what} to the new last day, ${formatDate(endDate)}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save', onPress: save },
    ]);
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-6 p-4 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-2">
        <Text className="text-sm font-medium">Name</Text>
        <Input value={name} onChangeText={setName} maxLength={TRIP_NAME_MAX_LENGTH} />
      </View>

      <TripDatesField value={dates} onChange={setDates} />

      <View className="gap-2">
        <Text className="text-sm font-medium">Notes</Text>
        {/* textAlignVertical: Android otherwise centres the text in the taller box */}
        <Input
          value={notes}
          onChangeText={setNotes}
          maxLength={TRIP_NOTES_MAX_LENGTH}
          placeholder="Bookings, ideas, what to pack…"
          multiline
          textAlignVertical="top"
          className="h-32 py-2"
        />
      </View>

      <Button
        size="lg"
        disabled={name.trim() === '' || isTooLong || isSaving}
        onPress={confirmSave}
      >
        {isSaving ? <ActivityIndicator /> : <Icon as={CheckIcon} />}
        <Text>Save</Text>
      </Button>
    </ScrollView>
  );
}
