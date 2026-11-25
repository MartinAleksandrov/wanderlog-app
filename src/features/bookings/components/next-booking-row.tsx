import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { toClockTime, toIsoDate } from '@/lib/dates';
import { useNow } from '@/lib/use-now';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { ChevronRightIcon, TicketsIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { bookingEvents, eventLabel, nextEvent, relativeDay } from '../booking-format';
import { BookingTile } from './booking-card';

type NextBookingRowProps = { tripId: Id<'trips'>; canEdit: boolean };

// The home card's line about bookings, which opens them: the next thing booked ("Tomorrow · 08:05,
// Flight LH 1234"), or how many there are once all are past, or an invitation to add the first.
export function NextBookingRow({ tripId, canEdit }: NextBookingRowProps) {
  const router = useRouter();
  const bookings = useQuery(api.bookings.listForTrip, { tripId });
  // Updated every minute, so a flight that has left drops off by itself
  const now = new Date(useNow());
  if (bookings === undefined) return null;
  // Viewers can't add any, so there's nothing to offer them
  if (bookings.length === 0 && !canEdit) return null;

  const next = nextEvent(bookingEvents(bookings), toIsoDate(now), toClockTime(now));
  const count = bookings.length === 1 ? '1 booking' : `${bookings.length} bookings`;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/trip/[tripId]/bookings', params: { tripId } })}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-xl bg-muted p-2.5 active:bg-accent"
    >
      {next ? (
        <BookingTile booking={next.booking} small />
      ) : (
        <View className="size-8 items-center justify-center rounded-full bg-background">
          <Icon as={TicketsIcon} className="size-4 text-muted-foreground" />
        </View>
      )}
      <View className="flex-1">
        {next ? (
          <>
            <Text variant="muted" className="text-xs">
              Next · {relativeDay(next.date, toIsoDate(now))}
              {next.time ? `, ${next.time}` : ''}
            </Text>
            <Text className="text-sm font-medium" numberOfLines={1}>
              {eventLabel(next)}
            </Text>
          </>
        ) : (
          <>
            <Text variant="muted" className="text-xs">
              Bookings
            </Text>
            <Text className="text-sm font-medium">
              {bookings.length === 0 ? 'Add hotels, flights and tickets' : count}
            </Text>
          </>
        )}
      </View>
      <Icon as={ChevronRightIcon} className="size-4 text-muted-foreground" />
    </Pressable>
  );
}
