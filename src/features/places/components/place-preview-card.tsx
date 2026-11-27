import { PlacePhoto } from '@/components/place-photo';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { errorMessage } from '@/lib/error-message';
import { formatDistance } from '@/lib/geo';
import { APP_LOCALE } from '@/lib/locale';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';
import { api } from '@convex/_generated/api';
import type { SuggestedPlace } from '@convex/googlePlaces';
import { skipToken, useQuery as useCachedQuery } from '@tanstack/react-query';
import { useAction } from 'convex/react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ChevronRightIcon,
  PlaneTakeoffIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react-native';
import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  Easing,
  FadeInDown,
  FadeOutDown,
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { openStatus } from '../open-status';
import { placeDetailsHref } from '../place-details-href';
import type { PlaceMode } from '../place-modes';
import { DirectionsButton } from './directions-button';
import { OpenBadge } from './open-badge';
import type { Pin } from './pin-layer';
import { SAVED_POP } from './saved-pop';

type PlacePreviewCardProps = {
  pin: Pin;
  // Sights, sweet spots or restaurants: the card's colours, words and saved mark
  mode: PlaceMode;
  // Metres from the phone, when it's in the city (see use-distance.ts)
  distance?: number;
  // Set while exploring another city: its places can't join the current trip, so the main
  // button offers to plan a trip there instead
  exploringCity?: string;
  // Missing when there's no trip to save to (a place found with the search bar before the first
  // trip): the card then has no main button
  onAdd?: () => void;
  onRemove: () => void;
  onPlanTrip: () => void;
  onClose: () => void;
};

// A swipe down closes the pop-up when the card would come to rest at least this far below its
// place (in dp), about a quarter of the card. Otherwise it springs back.
const CLOSE_DISTANCE = 80;
// Where the card would come to rest: where the finger let go, plus this many seconds at the
// finger's speed (iOS sheets decide the same way). So a short quick flick closes it, while a
// short slow drag, or one that turns back up before letting go, springs back.
const MOMENTUM_SECONDS = 0.2;
// Pulled above its place, the card follows the finger only this much of the way, so it gives a
// little, like a native sheet, instead of stopping dead
const UP_RESISTANCE = 0.2;
// How long the card takes to slide off the screen once let go (see slideDuration)
const MIN_SLIDE_MS = 120;
const MAX_SLIDE_MS = 280;
// The gap under the card, which keeps Google's logo visible
const CARD_BOTTOM = 40;

// The pop-up at the bottom of the map for the tapped pin: the place's photos (swipe for more),
// rating, how far away it is (in the city), Google's short description, and the buttons:
// - the main one: save a suggestion ("Add to trip" / "Save sweet spot" / "Save restaurant"),
//   remove a saved place, or "Plan a trip" while exploring another city
// - Directions: the blue Google Maps arrow, opens turn-by-turn directions to the place
// - Details: the full sheet with hours, contact details and reviews
//
// It floats a little above the bottom edge so Google's logo (bottom left) stays visible, which
// Google requires. Swiping it down closes it, and so does Android's back button (before leaving
// the screen).
export function PlacePreviewCard({
  pin,
  mode,
  distance,
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
  const swipe = useSwipeDownToClose(onClose, pin.key);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        onClose();
        return true;
      });
      return () => subscription.remove();
    }, [onClose]),
  );

  // The full details sheet. Name and photo go along so its top shows at once, and the side,
  // so its button saves to the same list.
  function openDetails() {
    if (placeId === undefined) return;
    router.push(
      placeDetailsHref({ placeId, name: pin.name, photoName: pin.photoName, kind: mode.kind }),
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(160)}
      style={styles.position}
    >
      {/* The card follows the finger down. Its own view, so after a swipe the fade-out above
          (when it closes) starts from below the screen, where the card slid to. */}
      <GestureDetector gesture={swipe.gesture}>
        <Animated.View
          style={swipe.style}
          onLayout={swipe.onLayout}
          className={cn('gap-3 rounded-3xl border bg-background p-3 shadow-lg', mode.cardBorder)}
        >
          <View className="flex-row items-start gap-2 pl-1">
            <View className="flex-1 gap-1">
              <Text className="text-lg leading-6 font-semibold" numberOfLines={2}>
                {pin.name}
              </Text>
              <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
                <PlaceFacts
                  category={category}
                  place={place}
                  distance={distance}
                  isLoading={details.isLoading}
                />
                {/* Pops in when the place is saved here, not when an already-saved one opens */}
                <LayoutAnimationConfig skipEntering>
                  {pin.saved ? <SavedTag mode={mode} /> : null}
                </LayoutAnimationConfig>
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
              mode={mode}
              exploringCity={exploringCity}
              onAdd={onAdd}
              onRemove={onRemove}
              onPlanTrip={onPlanTrip}
            />
            <DirectionsButton
              destination={{
                name: pin.name,
                coordinates: pin.coordinates,
                providerPlaceId: placeId,
              }}
            />
            <Button variant="outline" disabled={placeId === undefined} onPress={openDetails}>
              <Text>Details</Text>
              <Icon as={ChevronRightIcon} className="size-4" />
            </Button>
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

// Swipe down to close, like a native bottom sheet. The gesture starts only once the finger has
// moved 10 dp down. It gives up when the finger moves 12 dp sideways first, so swiping through
// the photos still works, and taps on the buttons never move far enough to start it.
//
// The card's position is a shared value moved on the UI thread (Gesture Handler's default when
// Reanimated is installed), so it keeps up with the finger without a round trip to JavaScript.
// When the finger lets go, the card springs back or slides off the bottom at the finger's speed,
// and closes only once it's gone. Closing goes to the JS thread (scheduleOnRN), since it changes
// React state. Grabbing the card while it moves picks it up where it is.
function useSwipeDownToClose(onClose: () => void, pinKey: string) {
  const offset = useSharedValue(0);
  // The offset the finger's movement adds to. It's taken when the gesture starts, less the 10 dp
  // the finger moved before that, so the card doesn't jump.
  const start = useSharedValue(0);
  // The card's height: sliding down by this, plus the gap under it, takes it off the screen
  const height = useSharedValue(0);

  // Another pin tapped while the card slides away: its card shows in place, and setting the value
  // cancels the slide, so the slide's close (which would close the new pin) never runs
  useEffect(() => {
    offset.set(0);
  }, [pinKey, offset]);

  const gesture = usePanGesture({
    activeOffsetY: 10,
    failOffsetX: [-12, 12],
    onActivate: (event) => {
      'worklet';
      start.set(offset.get() - event.translationY);
    },
    onUpdate: (event) => {
      'worklet';
      const y = start.get() + event.translationY;
      offset.set(y < 0 ? y * UP_RESISTANCE : y);
    },
    onDeactivate: (event) => {
      'worklet';
      const restsAt = offset.get() + event.velocityY * MOMENTUM_SECONDS;
      if (event.canceled || restsAt < CLOSE_DISTANCE) {
        // Carries on at the finger's speed, then settles without a bounce
        offset.set(withSpring(0, { velocity: event.velocityY }));
        return;
      }
      const offScreen = height.get() + CARD_BOTTOM;
      const duration = slideDuration(offScreen - offset.get(), event.velocityY);
      offset.set(
        withTiming(offScreen, { duration, easing: Easing.out(Easing.quad) }, (finished) => {
          if (finished) scheduleOnRN(onClose);
        }),
      );
    },
  });
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  const onLayout = (event: LayoutChangeEvent) => height.set(event.nativeEvent.layout.height);
  return { gesture, style, onLayout };
}

// The slide off the screen eases out, so it starts at twice its average speed. Lasting
// 2 × distance ÷ speed, it starts at the finger's speed instead of jumping ahead or lagging behind.
// The clamp keeps a slow let-go brisk and a hard flick still visible.
function slideDuration(distance: number, velocity: number) {
  'worklet';
  return clamp((2000 * distance) / Math.max(velocity, 1), MIN_SLIDE_MS, MAX_SLIDE_MS);
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

// The card's main button: remove a saved place, plan a trip to an explored city, or save a
// suggestion (in the suggestion pins' colour). None without a trip to save to.
function MainAction({
  pin,
  mode,
  exploringCity,
  onAdd,
  onRemove,
  onPlanTrip,
}: Omit<PlacePreviewCardProps, 'onClose'>) {
  if (pin.saved) {
    return (
      <Button variant="outline" className="flex-1" onPress={onRemove}>
        <Icon as={Trash2Icon} className="size-4 text-destructive" />
        <Text numberOfLines={1} className="shrink text-destructive">
          {mode.removeLabel}
        </Text>
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
  if (onAdd === undefined) return null;
  return (
    <Button
      className={cn('flex-1', mode.addButton)}
      disabled={pin.suggestion === undefined}
      onPress={onAdd}
    >
      <Icon as={PlusIcon} className="size-4 text-white" />
      <Text numberOfLines={1} className="shrink text-white">
        {mode.addLabel}
      </Text>
    </Button>
  );
}

// "Museum ★ 4.8 (64,836) 100 m away ● Open · closes 18:00", wrapping onto a second line when
// needed. The open status follows the clock while the pop-up is open.
function PlaceFacts({
  category,
  place,
  distance,
  isLoading,
}: {
  category?: string;
  place?: SuggestedPlace;
  distance?: number;
  isLoading: boolean;
}) {
  const now = useNow();
  const status = openStatus(place?.hours, now);
  return (
    <>
      {category ? <Text variant="muted">{category}</Text> : null}
      {place?.rating ? <RatingText rating={place.rating} ratingCount={place.ratingCount} /> : null}
      {distance === undefined ? null : (
        <Text className="text-sm font-medium">{formatDistance(distance)} away</Text>
      )}
      {status ? <OpenBadge status={status} /> : null}
      {isLoading ? <ActivityIndicator size="small" /> : null}
    </>
  );
}

// "★ 4.6 (5,338)": the same solid orange star as the places list
function RatingText({ rating, ratingCount }: { rating: number; ratingCount?: number }) {
  return (
    <Text className="text-sm font-medium">
      <Text className="text-sm text-orange-500">★</Text> {rating.toFixed(1)}
      {ratingCount ? (
        <Text variant="muted"> ({ratingCount.toLocaleString(APP_LOCALE)})</Text>
      ) : null}
    </Text>
  );
}

// The "✓ In your trip" / "♥ Saved" tag, matching the saved pin's mark
function SavedTag({ mode }: { mode: PlaceMode }) {
  return (
    <Animated.View entering={SAVED_POP}>
      <View className={cn('flex-row items-center gap-1 rounded-full px-2 py-0.5', mode.tag)}>
        <Icon as={mode.savedIcon} strokeWidth={3} className={cn('size-3', mode.tagText)} />
        <Text className={cn('text-xs font-semibold', mode.tagText)}>{mode.savedLabel}</Text>
      </View>
    </Animated.View>
  );
}

// The place's photos side by side; swipe for more. Only photos near the screen are loaded, so
// photos nobody swipes to aren't requested (each one is a paid Google request).
//
// The first photo is asked for 900 px wide, like the places list's cards and the single photo
// below, so it's the same address the phone has cached: a place already seen in the list, or
// whose stored photo showed while Google's details loaded, costs no second request for it. The
// rest are small (480 px), since nothing else shows them.
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
      renderItem={({ item, index }) => (
        <PlacePhoto
          photoName={item}
          category={category}
          width={index === 0 ? 900 : 480}
          className="h-28 w-40 rounded-2xl"
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  // Above the bottom edge, leaving room for Google's logo under the card
  position: { position: 'absolute', left: 12, right: 12, bottom: CARD_BOTTOM },
});
