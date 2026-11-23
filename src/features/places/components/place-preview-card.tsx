import { PlacePhoto } from '@/components/place-photo';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { errorMessage } from '@/lib/error-message';
import { api } from '@convex/_generated/api';
import { skipToken, useQuery as useCachedQuery } from '@tanstack/react-query';
import { useAction } from 'convex/react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  CheckIcon,
  ChevronRightIcon,
  PlaneTakeoffIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react-native';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import type { Pin } from './pin-layer';

type PlacePreviewCardProps = {
  pin: Pin;
  // Set while exploring another city: its places can't join the current trip, so the main
  // button offers to plan a trip there instead
  exploringCity?: string;
  onAdd: () => void;
  onRemove: () => void;
  onPlanTrip: () => void;
  onClose: () => void;
};

// The pop-up at the bottom of the map for the tapped pin: the place's photos (swipe for more),
// rating, Google's short description, and one main button: "Add to trip" for a suggestion,
// "Remove from trip" for a place already in the trip, or "Plan a trip" while exploring another
// city. "Details" opens the full sheet with hours, contact details and reviews.
//
// It floats a little above the bottom edge so Google's logo (bottom left) stays visible, which
// Google requires. Android's back button closes it before leaving the screen.
export function PlacePreviewCard({
  pin,
  exploringCity,
  onAdd,
  onRemove,
  onPlanTrip,
  onClose,
}: PlacePreviewCardProps) {
  const router = useRouter();
  const { place, details } = usePinPlace(pin);
  const placeId = pin.suggestion?.providerPlaceId ?? pin.saved?.providerPlaceId;
  const category = place?.category ?? pin.category;
  // Until Google's photos are known, the pin's own photo
  const fallbackPhotos = pin.photoName ? [pin.photoName] : [];
  const photoNames = place?.photoNames.length ? place.photoNames : fallbackPhotos;

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        onClose();
        return true;
      });
      return () => subscription.remove();
    }, [onClose]),
  );

  // The full details sheet. Name and photo go along so its top shows at once.
  function openDetails() {
    if (placeId === undefined) return;
    router.push({
      pathname: '/place/[placeId]',
      params: { placeId, name: pin.name, photoName: pin.photoName ?? '' },
    });
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(160)}
      style={styles.position}
    >
      <View className="gap-3 rounded-3xl border border-border bg-background p-3 shadow-lg">
        <View className="flex-row items-start gap-2 pl-1">
          <View className="flex-1 gap-1">
            <Text className="text-lg leading-6 font-semibold" numberOfLines={2}>
              {pin.name}
            </Text>
            <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
              {category ? <Text variant="muted">{category}</Text> : null}
              {place?.rating ? (
                <RatingText rating={place.rating} ratingCount={place.ratingCount} />
              ) : null}
              {details.isLoading ? <ActivityIndicator size="small" /> : null}
              {pin.saved ? <InTripBadge /> : null}
            </View>
          </View>
          <Button
            variant="ghost"
            size="icon"
            className="-mt-1 -mr-1 rounded-full"
            aria-label="Close"
            onPress={onClose}
          >
            <Icon as={XIcon} className="text-muted-foreground" />
          </Button>
        </View>

        <PhotoRow photoNames={photoNames} category={category} />

        {place?.summary ? (
          <Text className="px-1 text-sm leading-5 text-muted-foreground" numberOfLines={2}>
            {place.summary}
          </Text>
        ) : null}
        {details.error ? (
          <Pressable onPress={() => void details.refetch()} className="px-1">
            <Text className="text-sm text-destructive">
              {errorMessage(details.error)} <Text className="text-sm font-semibold">Retry</Text>
            </Text>
          </Pressable>
        ) : null}

        <View className="flex-row gap-2">
          <MainAction
            pin={pin}
            exploringCity={exploringCity}
            onAdd={onAdd}
            onRemove={onRemove}
            onPlanTrip={onPlanTrip}
          />
          <Button variant="outline" disabled={placeId === undefined} onPress={openDetails}>
            <Text>Details</Text>
            <Icon as={ChevronRightIcon} className="size-4" />
          </Button>
        </View>
      </View>
    </Animated.View>
  );
}

// What Google says about the pin's place. A suggestion already has it all (rating, description,
// photos). A saved place outside the searched area has only what our backend stores, so it's
// looked up with the same request and cache key as the details sheet: opening "Details"
// afterwards doesn't pay Google again.
function usePinPlace(pin: Pin) {
  const getPlaceDetails = useAction(api.googlePlaces.placeDetails);
  const placeId = pin.suggestion ? undefined : pin.saved?.providerPlaceId;
  const details = useCachedQuery({
    queryKey: ['place-details', placeId],
    queryFn: placeId ? () => getPlaceDetails({ placeId }) : skipToken,
    staleTime: Infinity,
  });
  return { place: pin.suggestion ?? details.data, details };
}

// The card's main button: remove a trip place, plan a trip to an explored city, or add a
// suggestion to the trip (orange, like its pin)
function MainAction({
  pin,
  exploringCity,
  onAdd,
  onRemove,
  onPlanTrip,
}: Pick<PlacePreviewCardProps, 'pin' | 'exploringCity' | 'onAdd' | 'onRemove' | 'onPlanTrip'>) {
  if (pin.saved) {
    return (
      <Button variant="outline" className="flex-1" onPress={onRemove}>
        <Icon as={Trash2Icon} className="size-4 text-destructive" />
        <Text className="text-destructive">Remove from trip</Text>
      </Button>
    );
  }
  if (exploringCity) {
    return (
      <Button className="flex-1" onPress={onPlanTrip}>
        <Icon as={PlaneTakeoffIcon} className="size-4" />
        <Text numberOfLines={1} className="shrink">
          Plan a trip to {exploringCity}
        </Text>
      </Button>
    );
  }
  return (
    <Button
      className="flex-1 bg-orange-500 active:bg-orange-600"
      disabled={pin.suggestion === undefined}
      onPress={onAdd}
    >
      <Icon as={PlusIcon} className="size-4 text-white" />
      <Text className="text-white">Add to trip</Text>
    </Button>
  );
}

// "★ 4.6 (5,338)": the same solid orange star as the places list
function RatingText({ rating, ratingCount }: { rating: number; ratingCount?: number }) {
  return (
    <Text className="text-sm font-medium">
      <Text className="text-sm text-orange-500">★</Text> {rating.toFixed(1)}
      {ratingCount ? <Text variant="muted"> ({ratingCount.toLocaleString()})</Text> : null}
    </Text>
  );
}

// The purple "In your trip" tag, matching the pin's colour and check mark
function InTripBadge() {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 dark:bg-purple-950">
      <Icon
        as={CheckIcon}
        strokeWidth={3}
        className="size-3 text-purple-600 dark:text-purple-300"
      />
      <Text className="text-xs font-semibold text-purple-700 dark:text-purple-300">
        In your trip
      </Text>
    </View>
  );
}

// The place's photos side by side; swipe for more. Only photos near the screen are loaded, so
// photos nobody swipes to aren't requested (each one is a paid Google request).
function PhotoRow({ photoNames, category }: { photoNames: string[]; category?: string }) {
  // One photo (or none: an icon for the kind of place) fills the card's width
  if (photoNames.length <= 1) {
    return (
      <PlacePhoto
        photoName={photoNames[0]}
        category={category}
        width={900}
        className="h-28 w-full rounded-2xl"
        iconClassName="size-10"
      />
    );
  }
  return (
    <FlatList
      horizontal
      data={photoNames}
      keyExtractor={(name) => name}
      showsHorizontalScrollIndicator={false}
      initialNumToRender={3}
      windowSize={3}
      contentContainerClassName="gap-2"
      renderItem={({ item }) => (
        <PlacePhoto
          photoName={item}
          category={category}
          width={480}
          className="h-28 w-40 rounded-2xl"
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  // Above the bottom edge, leaving room for Google's logo under the card
  position: { position: 'absolute', left: 12, right: 12, bottom: 40 },
});
