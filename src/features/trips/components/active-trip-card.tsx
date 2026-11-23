import { PlacePhoto } from '@/components/place-photo';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useRouter } from 'expo-router';
import { LandmarkIcon, MapIcon, MapPinIcon, Trash2Icon } from 'lucide-react-native';
import { View } from 'react-native';
import { formatDateRange, tripStatus } from '../trip-dates';
import type { TripSummary } from '../types';

type ActiveTripCardProps = { trip: TripSummary; today: string; onDelete: () => void };

// The home screen's big card for the trip the map and places tabs show: cover photo, dates,
// how far away it is, saved places, and shortcuts to the other tabs.
export function ActiveTripCard({ trip, today, onDelete }: ActiveTripCardProps) {
  const router = useRouter();

  return (
    <View className="overflow-hidden rounded-xl border border-border bg-card">
      <PlacePhoto
        photoName={trip.destinationPhotoName}
        width={900}
        className="h-40 w-full"
        iconClassName="size-14"
      />
      <View className="gap-3 p-4">
        <View className="flex-row items-start gap-2">
          <View className="flex-1 gap-1">
            <Text variant="muted" className="font-medium text-orange-600">
              {tripStatus(trip.startDate, trip.endDate, today)}
            </Text>
            <Text variant="h4">{trip.name}</Text>
            <View className="flex-row items-center gap-1">
              <Icon as={MapPinIcon} className="size-4 text-muted-foreground" />
              <Text variant="muted" className="flex-1" numberOfLines={1}>
                {trip.destination}
              </Text>
            </View>
            <Text variant="muted">
              {formatDateRange(trip.startDate, trip.endDate)} ·{' '}
              {trip.placeCount === 1 ? '1 place saved' : `${trip.placeCount} places saved`}
            </Text>
          </View>
          {trip.role === 'owner' ? (
            <Button variant="ghost" size="icon" onPress={onDelete} aria-label="Delete trip">
              <Icon as={Trash2Icon} className="text-muted-foreground" />
            </Button>
          ) : null}
        </View>
        <View className="flex-row gap-2">
          <Button className="flex-1" onPress={() => router.navigate('/map')}>
            <Icon as={MapIcon} />
            <Text>Open map</Text>
          </Button>
          <Button variant="outline" className="flex-1" onPress={() => router.navigate('/places')}>
            <Icon as={LandmarkIcon} />
            <Text>Places</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
