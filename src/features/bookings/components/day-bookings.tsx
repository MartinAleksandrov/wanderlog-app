import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { ChevronRightIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { bookingEvents, eventLabel } from '../booking-format';
import { BookingTile } from './booking-card';

type DayBookingsProps = { tripId: Id<'trips'>; date: string };

// The plan day's bookings above its stops: "15:00 Check-in · Hotel Lisboa", "08:05 Flight LH 1234".
// Nothing when the day has none. A tap opens the trip's bookings, with codes and details.
export function DayBookings({ tripId, date }: DayBookingsProps) {
  const router = useRouter();
  // Convex shares one subscription between every screen asking for the same trip's bookings
  const bookings = useQuery(api.bookings.listForTrip, { tripId });
  const events = bookingEvents(bookings ?? []).filter((event) => event.date === date);
  if (events.length === 0) return null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/trip/[tripId]/bookings', params: { tripId } })}
      accessibilityRole="button"
      accessibilityHint="Shows the trip's bookings"
      className="flex-row items-center gap-2 rounded-2xl border border-border bg-card p-2.5 active:bg-accent"
    >
      <View className="flex-1 gap-2">
        {events.map((event) => (
          <View key={`${event.booking._id}-${event.edge}`} className="flex-row items-center gap-3">
            <BookingTile booking={event.booking} small />
            <Text className="w-12 text-sm font-semibold">{event.time ?? '—'}</Text>
            <Text className="flex-1 text-sm" numberOfLines={1}>
              {eventLabel(event)}
            </Text>
          </View>
        ))}
      </View>
      <Icon as={ChevronRightIcon} className="size-4 text-muted-foreground" />
    </Pressable>
  );
}
