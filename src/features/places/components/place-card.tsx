import { PlacePhoto } from '@/components/place-photo';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { CheckIcon, PlusIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

// What a card can show. Suggestions from Google have everything; a saved place that's outside
// the current search area has only what the backend stores.
export type PlaceInfo = {
  name: string;
  photoName?: string;
  category?: string;
  rating?: number;
  ratingCount?: number;
  summary?: string;
  address?: string;
};

type PlaceCardProps = {
  place: PlaceInfo;
  isSaved: boolean;
  onToggle: () => void;
  // Tapping the card (anywhere but the button) opens the place's pop-up with more details
  onPress: () => void;
};

// One place in the places tab: photo, type and rating, Google's short description, address,
// and a button that adds it to the trip (orange) or shows it's in the trip (purple, like the pins).
export function PlaceCard({ place, isSaved, onToggle, onPress }: PlaceCardProps) {
  const rating = place.rating
    ? `★ ${place.rating}${place.ratingCount ? ` (${place.ratingCount.toLocaleString()})` : ''}`
    : null;
  const details = [place.category, rating].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Shows more about this place"
      className="flex-row gap-3 rounded-xl border border-border bg-card p-3 active:bg-accent"
    >
      <PlacePhoto
        photoName={place.photoName}
        category={place.category}
        width={300}
        className="size-24 rounded-lg"
        iconClassName="size-9"
      />
      <View className="flex-1 gap-1">
        <Text className="font-semibold" numberOfLines={2}>
          {place.name}
        </Text>
        {details ? (
          <Text variant="muted" numberOfLines={1}>
            {details}
          </Text>
        ) : null}
        {place.summary ? (
          <Text className="text-sm" numberOfLines={3}>
            {place.summary}
          </Text>
        ) : null}
        {place.address ? (
          <Text variant="muted" numberOfLines={1}>
            {place.address}
          </Text>
        ) : null}
        <Button
          size="sm"
          onPress={onToggle}
          className={cn(
            'mt-1 self-start',
            isSaved ? 'bg-purple-600 active:bg-purple-700' : 'bg-orange-500 active:bg-orange-600',
          )}
        >
          <Icon as={isSaved ? CheckIcon : PlusIcon} className="size-4 text-white" />
          <Text className="text-white">{isSaved ? 'In your trip' : 'Add to trip'}</Text>
        </Button>
      </View>
    </Pressable>
  );
}
