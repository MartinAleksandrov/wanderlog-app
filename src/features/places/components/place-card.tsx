import { PlacePhoto } from '@/components/place-photo';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { Coordinates } from '@convex/schema';
import { PlusIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';
import type { PlaceMode } from '../place-modes';
import { DirectionsButton } from './directions-button';
import { SAVED_POP } from './saved-pop';

// What a card can show. Suggestions from Google have everything; a saved place that's outside
// the current search area has only what the backend stores.
export type PlaceInfo = {
  name: string;
  coordinates: Coordinates;
  providerPlaceId?: string;
  photoName?: string;
  category?: string;
  rating?: number;
  ratingCount?: number;
  summary?: string;
  address?: string;
};

type PlaceCardProps = {
  place: PlaceInfo;
  // Sights or sweet spots: the button's colours and words
  mode: PlaceMode;
  isSaved: boolean;
  onToggle: () => void;
  // Tapping the card (anywhere but the buttons) opens the place's pop-up with more details
  onPress: () => void;
};

// One place in the places tab: photo, type and rating, Google's short description, address, a
// button that saves it (suggestion colour) or shows it's saved (saved colour, like the pins),
// and directions in Google Maps.
export function PlaceCard({ place, mode, isSaved, onToggle, onPress }: PlaceCardProps) {
  const rating = place.rating
    ? `★ ${place.rating}${place.ratingCount ? ` (${place.ratingCount.toLocaleString()})` : ''}`
    : null;
  const details = [place.category, rating].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Shows more about this place"
      className={cn(
        'flex-row gap-3 rounded-xl border bg-card p-3 active:bg-accent',
        mode.cardBorder,
      )}
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
        <View className="mt-1 flex-row flex-wrap gap-2">
          <Button
            size="sm"
            onPress={onToggle}
            className={isSaved ? mode.savedButton : mode.addButton}
          >
            {/* The heart or check pops in when saved here; the + doesn't animate */}
            <LayoutAnimationConfig skipEntering>
              <Animated.View
                key={isSaved ? 'saved' : 'add'}
                entering={isSaved ? SAVED_POP : undefined}
              >
                <Icon as={isSaved ? mode.savedIcon : PlusIcon} className="size-4 text-white" />
              </Animated.View>
            </LayoutAnimationConfig>
            <Text className="text-white">{isSaved ? mode.savedLabel : mode.addLabel}</Text>
          </Button>
          {/* The same round blue arrow as on the map, so both buttons fit on one row */}
          <DirectionsButton destination={place} className="size-9" />
        </View>
      </View>
    </Pressable>
  );
}
