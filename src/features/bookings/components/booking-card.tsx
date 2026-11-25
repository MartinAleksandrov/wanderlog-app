import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { openLink } from '@/lib/open-link';
import { cn } from '@/lib/utils';
import { GlobeIcon, MapIcon, PhoneIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { BOOKING_KINDS, TRANSPORT_MODES } from '../booking-kinds';
import {
  bookingRoute,
  bookingTitle,
  formatMoney,
  formatWhen,
  nightsLabel,
  whenLabels,
  type Booking,
} from '../booking-format';
import { ConfirmationCode } from './confirmation-code';

type BookingCardProps = {
  booking: Booking;
  // Opens the edit form. Missing for viewers, who can only read.
  onEdit?: () => void;
};

// One booking with everything needed on the day: what and where, when it starts and ends, the
// booking code to copy, and buttons to find it on the map, call or open its website.
export function BookingCard({ booking, onEdit }: BookingCardProps) {
  const labels = whenLabels(booking.type, booking.type === 'transport' ? booking.mode : undefined);

  return (
    <Pressable
      onPress={onEdit}
      disabled={onEdit === undefined}
      accessibilityRole={onEdit ? 'button' : undefined}
      accessibilityHint={onEdit ? 'Edits this booking' : undefined}
      className="gap-3 rounded-2xl border border-border bg-card p-3 active:bg-accent"
    >
      <View className="flex-row items-start gap-3">
        <BookingTile booking={booking} />
        <View className="flex-1 gap-0.5">
          <Text className="font-semibold" numberOfLines={2}>
            {bookingTitle(booking)}
          </Text>
          {subtitle(booking) ? (
            <Text variant="muted" numberOfLines={2}>
              {subtitle(booking)}
            </Text>
          ) : null}
        </View>
        {booking.price ? <Text className="font-semibold">{formatMoney(booking.price)}</Text> : null}
      </View>

      <View className="flex-row gap-3">
        <When label={labels.start} text={formatWhen(booking.startDate, booking.startTime)} />
        {booking.endDate !== undefined ? (
          <When label={labels.end} text={formatWhen(booking.endDate, booking.endTime)} />
        ) : null}
      </View>
      {extras(booking) ? <Text variant="muted">{extras(booking)}</Text> : null}

      {booking.confirmationCode ? <ConfirmationCode code={booking.confirmationCode} /> : null}
      <BookingLinks booking={booking} />
      {booking.notes ? (
        <Text variant="muted" numberOfLines={4}>
          {booking.notes}
        </Text>
      ) : null}
    </Pressable>
  );
}

// The round icon in the booking type's colour; a transport shows its mode (train, car…)
export function BookingTile({ booking, small }: { booking: Booking; small?: boolean }) {
  const kind = BOOKING_KINDS[booking.type];
  const icon = booking.type === 'transport' ? TRANSPORT_MODES[booking.mode].icon : kind.icon;
  return (
    <View
      className={cn(
        'items-center justify-center rounded-full',
        small ? 'size-8' : 'size-10',
        kind.tile,
      )}
    >
      <Icon as={icon} className={cn(small ? 'size-4' : 'size-5', kind.tint)} />
    </View>
  );
}

function When({ label, text }: { label: string; text: string }) {
  return (
    <View className="flex-1 gap-0.5">
      <Text variant="muted" className="text-xs">
        {label}
      </Text>
      <Text className="text-sm font-medium">{text}</Text>
    </View>
  );
}

// The line under the title: an address, or "Lufthansa · SOF → MUC"
function subtitle(booking: Booking): string | undefined {
  switch (booking.type) {
    case 'stay':
    case 'activity':
      return booking.address;
    case 'flight':
      return [booking.airline, bookingRoute(booking)].filter(Boolean).join(' · ');
    case 'transport':
      return [TRANSPORT_MODES[booking.mode].label, bookingRoute(booking)]
        .filter(Boolean)
        .join(' · ');
  }
}

// Small facts under the times: "3 nights", "Terminal 2 · Seat 14A"
function extras(booking: Booking): string | undefined {
  if (booking.type === 'stay') return nightsLabel(booking.startDate, booking.endDate);
  if (booking.type === 'flight') {
    const parts = [
      booking.terminal && `Terminal ${booking.terminal}`,
      booking.seat && `Seat ${booking.seat}`,
    ];
    return parts.filter(Boolean).join(' · ') || undefined;
  }
  return undefined;
}

// Map, Call and Website buttons, for whatever the booking has. The map opens Google Maps on the
// place (or searches the typed address), where directions are one more tap in any travel mode.
function BookingLinks({ booking }: { booking: Booking }) {
  const isPlace = booking.type === 'stay' || booking.type === 'activity';
  const mapUrl = isPlace ? mapsUrl(booking) : undefined;
  const phone = booking.type === 'stay' ? booking.phone : undefined;
  const website = booking.type === 'stay' ? booking.website : undefined;
  if (!mapUrl && !phone && !website) return null;

  return (
    <View className="flex-row flex-wrap gap-2">
      {mapUrl ? <LinkButton icon={MapIcon} label="Map" url={mapUrl} /> : null}
      {phone ? (
        <LinkButton icon={PhoneIcon} label="Call" url={`tel:${phone.replace(/\s/g, '')}`} />
      ) : null}
      {website ? <LinkButton icon={GlobeIcon} label="Website" url={website} /> : null}
    </View>
  );
}

// Google Maps URLs need no API key (https://developers.google.com/maps/documentation/urls)
function mapsUrl(booking: Booking & { type: 'stay' | 'activity' }): string | undefined {
  const query = booking.type === 'stay' && booking.providerPlaceId ? booking.name : booking.address;
  if (!query) return undefined;
  const placeId =
    booking.type === 'stay' && booking.providerPlaceId
      ? `&query_place_id=${encodeURIComponent(booking.providerPlaceId)}`
      : '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}${placeId}`;
}

function LinkButton({ icon, label, url }: { icon: typeof MapIcon; label: string; url: string }) {
  return (
    <Button variant="outline" size="sm" onPress={() => openLink(url)}>
      <Icon as={icon} className="size-4" />
      <Text>{label}</Text>
    </Button>
  );
}
