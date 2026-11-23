import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { errorMessage } from '@/lib/error-message';
import { cn } from '@/lib/utils';
import { api } from '@convex/_generated/api';
import type { PlaceDetails } from '@convex/googlePlaces';
import { useQuery as useCachedQuery } from '@tanstack/react-query';
import { useAction, useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { PlusIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { DirectionsButton } from './components/directions-button';
import {
  PhotoStrip,
  PlaceFacts,
  PlaceSummaryLine,
  ReviewList,
  Section,
} from './components/place-details-parts';
import { PLACE_MODES, placeKindOf, type PlaceMode } from './place-modes';
import { usePlaceActions } from './use-place-actions';

// Route params. The name and photo come from the tapped card, so the top of the sheet shows
// at once while the rest loads. `kind` is the side it was opened from: the sheet sits outside
// the tabs, so it can't see their switch.
type PlaceParams = { placeId: string; name?: string; photoName?: string; kind?: string };

// The pop-up that slides up when a place is tapped in the places tab or "Details" on the map
// (a form sheet route, src/app/place/[placeId].tsx): photos, rating, opening hours, contact
// details and reviews, plus saving it or getting directions. Scrolls when it's taller than the
// sheet.
export function PlaceDetailsSheet() {
  const { placeId, name, photoName, kind } = useLocalSearchParams<PlaceParams>();
  const mode = PLACE_MODES[kind === 'sweet' ? 'sweet' : 'sight'];
  const getPlaceDetails = useAction(api.googlePlaces.placeDetails);
  // Cached per place: opening the same place again doesn't call Google
  const details = useCachedQuery({
    queryKey: ['place-details', placeId],
    queryFn: () => getPlaceDetails({ placeId }),
    staleTime: Infinity,
  });
  const place = details.data;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 px-5 pt-3 pb-12">
      {/* A handle, so the sheet looks draggable (the native one is iOS only) */}
      <View className="h-1 w-10 self-center rounded-full bg-border" />
      <PhotoStrip
        photoNames={place?.photoNames ?? (photoName ? [photoName] : [])}
        category={place?.category}
      />
      <View className="gap-1.5">
        <Text variant="h3">{place?.name ?? name}</Text>
        {place ? <PlaceSummaryLine place={place} /> : null}
      </View>
      <PlaceButtons place={place} mode={mode} />

      {place ? (
        <>
          {place.summary ? (
            <Section title="About">
              <Text className="leading-6">{place.summary}</Text>
            </Section>
          ) : null}
          <PlaceFacts place={place} />
          {place.reviews.length > 0 ? (
            <Section title="Reviews from Google">
              <ReviewList reviews={place.reviews} />
            </Section>
          ) : null}
        </>
      ) : details.error ? (
        <Pressable onPress={() => void details.refetch()} className="items-center gap-1 py-6">
          <Text className="text-center text-sm text-destructive">
            {errorMessage(details.error)}
          </Text>
          <Text className="text-sm font-semibold">Tap to try again</Text>
        </Pressable>
      ) : (
        <ActivityIndicator className="py-8" />
      )}

      <Text className="text-xs text-muted-foreground">
        Place information and photos from Google
      </Text>
    </ScrollView>
  );
}

// Save the place to the active trip's list for this side ("Add to trip" / "Save sweet spot"),
// or show it's saved (tap to remove), and directions in Google Maps. Saving waits until the
// details have loaded.
function PlaceButtons({ place, mode }: { place?: PlaceDetails; mode: PlaceMode }) {
  const trip = useQuery(api.trips.active);
  const saved = useQuery(api.places.listForTrip, trip ? { tripId: trip._id } : 'skip');
  const { add, confirmRemove } = usePlaceActions(trip?._id, mode.kind);
  const savedPlace =
    place &&
    saved?.find((p) => p.providerPlaceId === place.providerPlaceId && placeKindOf(p) === mode.kind);

  return (
    <View className="flex-row gap-2">
      {trip ? (
        <Button
          disabled={place === undefined}
          className={cn('flex-1', savedPlace ? mode.savedButton : mode.addButton)}
          onPress={() => {
            if (savedPlace) confirmRemove(savedPlace);
            else if (place) void add(place);
          }}
        >
          <Icon as={savedPlace ? mode.savedIcon : PlusIcon} className="size-4 text-white" />
          <Text className="text-white">{savedPlace ? mode.savedLabel : mode.addLabel}</Text>
        </Button>
      ) : null}
      {place ? <DirectionsButton withLabel destination={place} className="h-10 flex-1" /> : null}
    </View>
  );
}
