import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDateRange, formatWeekdayDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { api } from '@convex/_generated/api';
import type { BookingType } from '@convex/schema';
import { useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TicketsIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { BOOKING_KINDS, BOOKING_TYPE_ORDER } from './booking-kinds';
import { totalPrice, type Booking } from './booking-format';
import { BookingCard } from './components/booking-card';

// The trip's bookings (route /trip/<trip ID>/bookings): hotels, flights, transport and tickets in
// time order, grouped by the day they start, with what they cost together. Editors get buttons to
// add each type, and tap a booking to change it.
export function BookingsScreen() {
  const router = useRouter();
  // A plain string from the URL; trips.get checks that it's a trip ID
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const trip = useQuery(api.trips.get, { tripId });
  const bookings = useQuery(api.bookings.listForTrip, trip ? { tripId: trip._id } : 'skip');

  if (trip === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text variant="muted">This trip no longer exists.</Text>
      </View>
    );
  }
  if (trip === undefined || bookings === undefined) {
    return <ActivityIndicator className="flex-1 bg-background" />;
  }

  const canEdit = trip.role !== 'viewer';
  const total = totalPrice(bookings);
  const count = bookings.length === 1 ? '1 booking' : `${bookings.length} bookings`;

  // New prices start in the currency of the last priced booking added to this trip
  const lastPriced = bookings
    .filter((booking) => booking.price !== undefined)
    .sort((a, b) => b._creationTime - a._creationTime)[0];
  const currency = lastPriced?.price?.currency ?? 'EUR';

  function add(type: BookingType) {
    if (!trip) return;
    router.push({
      pathname: '/trip/[tripId]/booking',
      params: { tripId: trip._id, type, currency },
    });
  }

  function edit(booking: Booking) {
    router.push({
      pathname: '/trip/[tripId]/booking',
      params: { tripId: booking.tripId, bookingId: booking._id },
    });
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-12">
      <View className="gap-1">
        <Text variant="h4">{trip.name}</Text>
        <Text variant="muted">
          {formatDateRange(trip.startDate, trip.endDate)}
          {bookings.length > 0 ? ` · ${count}` : ''}
          {total ? ` · ${total} booked` : ''}
        </Text>
      </View>

      {canEdit ? <AddButtons onAdd={add} /> : null}

      {bookings.length === 0 ? (
        <EmptyBookings canEdit={canEdit} />
      ) : (
        groupByStartDate(bookings).map(([date, dayBookings]) => (
          <View key={date} className="gap-2">
            <Text className="text-sm font-semibold text-muted-foreground uppercase">
              {formatWeekdayDate(date)}
            </Text>
            {dayBookings.map((booking) => (
              <BookingCard
                key={booking._id}
                booking={booking}
                onEdit={canEdit ? () => edit(booking) : undefined}
              />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

// One button per booking type, side by side: "Stay", "Flight", "Transport", "Activity"
function AddButtons({ onAdd }: { onAdd: (type: BookingType) => void }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium">Add a booking</Text>
      <View className="flex-row gap-2">
        {BOOKING_TYPE_ORDER.map((type) => {
          const kind = BOOKING_KINDS[type];
          return (
            <Pressable
              key={type}
              onPress={() => onAdd(type)}
              accessibilityRole="button"
              accessibilityLabel={kind.add}
              className="flex-1 items-center gap-1.5 rounded-xl border border-border bg-card py-3 active:bg-accent"
            >
              <View className={cn('size-10 items-center justify-center rounded-full', kind.tile)}>
                <Icon as={kind.icon} className={cn('size-5', kind.tint)} />
              </View>
              <Text className="text-xs font-medium">{kind.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function EmptyBookings({ canEdit }: { canEdit: boolean }) {
  return (
    <View className="items-center gap-2 rounded-2xl border border-dashed border-border p-6">
      <Icon as={TicketsIcon} className="size-8 text-muted-foreground" />
      <Text className="font-semibold">No bookings yet</Text>
      <Text variant="muted" className="text-center">
        {canEdit
          ? 'Keep your hotel, flights and tickets here, with their booking codes and prices, ready for the day.'
          : 'Bookings added to this trip show up here.'}
      </Text>
    </View>
  );
}

// The bookings (already in time order) under the date each starts on
function groupByStartDate(bookings: Booking[]): [string, Booking[]][] {
  const groups = new Map<string, Booking[]>();
  for (const booking of bookings) {
    groups.set(booking.startDate, [...(groups.get(booking.startDate) ?? []), booking]);
  }
  return [...groups];
}
