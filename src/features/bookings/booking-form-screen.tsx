import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { showError } from '@/lib/error-message';
import { api } from '@convex/_generated/api';
import type { BookingType } from '@convex/schema';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { CheckIcon, Trash2Icon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import {
  bookingFromDraft,
  draftFromBooking,
  draftProblem,
  newDraft,
  type BookingDraft,
} from './booking-draft';
import type { Booking } from './booking-format';
import { BOOKING_KINDS, BOOKING_TYPE_ORDER } from './booking-kinds';
import { CommonFields, WhatFields, WhenFields } from './components/booking-fields';

type Trip = NonNullable<FunctionReturnType<typeof api.trips.get>>;

// Route params: a new booking comes with its type (and the currency to start with); an existing
// one with its ID
type BookingFormParams = {
  tripId: string;
  type?: BookingType;
  currency?: string;
  bookingId?: string;
};

// The add/edit booking pop-up (route /trip/<trip ID>/booking). Waits for the trip, and the booking
// when editing, then shows the form filled in.
export function BookingFormScreen() {
  const params = useLocalSearchParams<BookingFormParams>();
  const trip = useQuery(api.trips.get, { tripId: params.tripId });
  const booking = useQuery(
    api.bookings.get,
    params.bookingId ? { bookingId: params.bookingId } : 'skip',
  );

  if (trip === null) return <Message text="This trip no longer exists." />;
  if (booking === null) return <Message text="This booking no longer exists." />;
  if (trip?.role === 'viewer') return <Message text="You can see this trip, but not change it." />;
  if (trip === undefined || (params.bookingId && booking === undefined)) {
    return <ActivityIndicator className="flex-1 bg-background" />;
  }
  // From the URL, so checked: an unknown type falls back to a stay
  const type = BOOKING_TYPE_ORDER.find((t) => t === params.type) ?? 'stay';
  return (
    <BookingForm
      trip={trip}
      booking={booking ?? undefined}
      initialDraft={
        booking ? draftFromBooking(booking) : newDraft(type, trip, params.currency ?? 'EUR')
      }
    />
  );
}

function Message({ text }: { text: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text variant="muted">{text}</Text>
    </View>
  );
}

// A separate component so the form's state starts from the loaded booking, and later changes to
// it (someone else editing) don't overwrite what the user is typing
function BookingForm({
  trip,
  booking,
  initialDraft,
}: {
  trip: Trip;
  booking?: Booking;
  initialDraft: BookingDraft;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [isSaving, setIsSaving] = useState(false);
  const createBooking = useMutation(api.bookings.create);
  const updateBooking = useMutation(api.bookings.update);
  const removeBooking = useMutation(api.bookings.remove);

  const kind = BOOKING_KINDS[draft.type];
  const title = booking ? `Edit ${kind.noun}` : kind.add;

  function change(fields: Partial<BookingDraft>) {
    setDraft((current) => ({ ...current, ...fields }));
  }

  // A promise chain, not try/finally: React Compiler can't compile a `finally` block yet
  function save() {
    const problem = draftProblem(draft);
    if (problem !== null) {
      Alert.alert("Can't save yet", problem);
      return;
    }
    setIsSaving(true);
    const input = bookingFromDraft(draft);
    const saving = booking
      ? updateBooking({ bookingId: booking._id, booking: input })
      : createBooking({ tripId: trip._id, booking: input });
    void saving
      .then(() => router.back())
      .catch((error: unknown) => showError("Couldn't save the booking", error))
      // After router.back() the screen is closing; React ignores the update then
      .finally(() => setIsSaving(false));
  }

  function confirmDelete() {
    if (!booking) return;
    Alert.alert(
      `Delete this ${kind.noun}?`,
      "Its details and booking code are deleted. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void removeBooking({ bookingId: booking._id })
              .then(() => router.back())
              .catch((error: unknown) => showError("Couldn't delete the booking", error)),
        },
      ],
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-5 p-4 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title }} />
      <WhatFields draft={draft} onChange={change} near={trip.destinationCoordinates} />
      <WhenFields draft={draft} onChange={change} />
      <CommonFields draft={draft} onChange={change} />

      <Button size="lg" disabled={isSaving} onPress={save}>
        {isSaving ? <ActivityIndicator /> : <Icon as={CheckIcon} />}
        <Text>Save</Text>
      </Button>
      {booking ? (
        <Button variant="ghost" onPress={confirmDelete}>
          <Icon as={Trash2Icon} className="size-4 text-destructive" />
          <Text className="text-destructive">Delete {kind.noun}</Text>
        </Button>
      ) : null}
    </ScrollView>
  );
}
