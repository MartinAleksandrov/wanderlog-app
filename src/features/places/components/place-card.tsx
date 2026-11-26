import { PlacePhoto } from '@/components/place-photo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDistance } from '@/lib/geo';
import { cn } from '@/lib/utils';
import type { PlaceHours } from '@convex/googlePlaces';
import type { Coordinates } from '@convex/schema';
import { PlusIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';
import type { OpenStatus } from '../open-status';
import type { PlaceMode } from '../place-modes';
import { OpenBadge } from './open-badge';
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
  hours?: PlaceHours;
};

type PlaceCardProps = {
  place: PlaceInfo;
  // Sights, sweet spots or restaurants: the save button's colours and words
  mode: PlaceMode;
  isSaved: boolean;
  // Metres from the phone, when it's in the city (see use-distance.ts)
  distance?: number;
  // "Open · closes 18:00", when its hours are known
  openStatus?: OpenStatus | null;
  onToggle: () => void;
  // Tapping the card (anywhere but the save button) opens the place's pop-up with the rest
  onPress: () => void;
};

// One place in the places tab, kept short so the photos do the talking: a big photo across the
// card with the save button on its corner, then the name, type and rating, whether it's open and
// how far away it is. Google's description, the address, more photos and directions are one tap
// away, in the place's pop-up. The photo is asked for 900 px wide, like the pop-up's photos, so
// the pop-up shows it at once from the phone's cache instead of paying Google for it again.
//
// The save button sits next to the card's pressable part, not inside it: a screen reader reads a
// button as one element and skips the buttons inside it, so a save button inside the card could
// never be reached. Drawn after it, the save button is on top and gets its own taps.
export function PlaceCard({
  place,
  mode,
  isSaved,
  distance,
  openStatus,
  onToggle,
  onPress,
}: PlaceCardProps) {
  return (
    <View className={cn('overflow-hidden rounded-2xl border bg-card', mode.cardBorder)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityHint="Shows more about this place"
        className="active:opacity-90"
      >
        <PlacePhoto
          photoName={place.photoName}
          category={place.category}
          width={900}
          className="h-44 w-full"
          iconClassName="size-12"
        />
        <View className="gap-1 px-4 pt-3 pb-4">
          <Text className="text-base font-semibold" numberOfLines={1}>
            {place.name}
          </Text>
          <KindAndRating place={place} />
          <OpenAndDistance status={openStatus} distance={distance} />
        </View>
      </Pressable>
      <SaveButton
        mode={mode}
        isSaved={isSaved}
        onPress={onToggle}
        className="absolute top-3 right-3"
      />
    </View>
  );
}

// The round button on the photo: a + in the side's suggestion colour, or its saved mark (check,
// heart or bookmark) in the saved colour, like the pins. The mark pops in when saved here.
function SaveButton({
  mode,
  isSaved,
  onPress,
  className,
}: {
  mode: PlaceMode;
  isSaved: boolean;
  onPress: () => void;
  className?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isSaved ? mode.removeLabel : mode.addLabel}
      hitSlop={8}
      className={cn(
        'size-11 items-center justify-center rounded-full border-2 border-white shadow-md',
        isSaved ? mode.savedButton : mode.addButton,
        className,
      )}
    >
      <LayoutAnimationConfig skipEntering>
        <Animated.View key={isSaved ? 'saved' : 'add'} entering={isSaved ? SAVED_POP : undefined}>
          <Icon as={isSaved ? mode.savedIcon : PlusIcon} className="size-5 text-white" />
        </Animated.View>
      </LayoutAnimationConfig>
    </Pressable>
  );
}

// "Museum · ★ 4.5 (3,721)"
function KindAndRating({ place }: { place: PlaceInfo }) {
  const rating = place.rating
    ? `★ ${place.rating}${place.ratingCount ? ` (${place.ratingCount.toLocaleString()})` : ''}`
    : null;
  const text = [place.category, rating].filter(Boolean).join(' · ');
  if (!text) return null;
  return (
    <Text variant="muted" numberOfLines={1}>
      {text}
    </Text>
  );
}

// "● Open · closes 18:00   350 m away" on one line, wrapping when the phone is narrow
function OpenAndDistance({ status, distance }: { status?: OpenStatus | null; distance?: number }) {
  if (!status && distance === undefined) return null;
  return (
    <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
      {status ? <OpenBadge status={status} /> : null}
      {distance === undefined ? null : (
        <Text className="text-sm font-semibold">{formatDistance(distance)} away</Text>
      )}
    </View>
  );
}
