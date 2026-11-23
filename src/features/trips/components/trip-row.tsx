import { PlacePhoto } from '@/components/place-photo';
import { Text } from '@/components/ui/text';
import { Pressable, View } from 'react-native';
import { formatDateRange } from '../trip-dates';
import type { TripSummary } from '../types';

// One trip in the home screen's "Upcoming" and "Previous" lists. Tapping it makes it the
// active trip, which moves it into the big card and onto the map.
export function TripRow({ trip, onPress }: { trip: TripSummary; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-2 active:bg-accent"
    >
      <PlacePhoto
        photoName={trip.destinationPhotoName}
        width={180}
        className="size-14 rounded-lg"
      />
      <View className="flex-1 gap-0.5">
        <Text className="font-semibold" numberOfLines={1}>
          {trip.name}
        </Text>
        <Text variant="muted" numberOfLines={1}>
          {formatDateRange(trip.startDate, trip.endDate)}
        </Text>
        <Text variant="muted">
          {trip.placeCount === 1 ? '1 place' : `${trip.placeCount} places`}
        </Text>
      </View>
    </Pressable>
  );
}
