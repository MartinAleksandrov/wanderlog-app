import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { errorMessage } from '@/lib/error-message';
import { openLink } from '@/lib/open-link';
import { cn } from '@/lib/utils';
import { api } from '@convex/_generated/api';
import type { PlaceDetails } from '@convex/googlePlaces';
import { useQuery as useCachedQuery } from '@tanstack/react-query';
import { useAction, useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { CheckIcon, NavigationIcon, PlusIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import {
  PhotoStrip,
  PlaceFacts,
  PlaceSummaryLine,
  ReviewList,
  Section,
} from './components/place-details-parts';
import { usePlaceActions } from './use-place-actions';

// Route params. The name and photo come from the tapped card, so the top of the sheet shows
// at once while the rest loads.
type PlaceParams = { placeId: string; name?: string; photoName?: string };

// The pop-up that slides up when a place is tapped in the places tab (a form sheet route,
// src/app/place/[placeId].tsx): photos, rating, opening hours, contact details and reviews, plus
// adding it to the trip or getting directions. Scrolls when it's taller than the sheet.
export function PlaceDetailsSheet() {
  const { placeId, name, photoName } = useLocalSearchParams<PlaceParams>();
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
      <PlaceButtons place={place} />

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

// "Add to trip" (orange) or "In your trip" (purple, tap to remove) for the active trip, and
// directions in Google Maps. Disabled until the details have loaded.
function PlaceButtons({ place }: { place?: PlaceDetails }) {
  const trip = useQuery(api.trips.active);
  const saved = useQuery(api.places.listForTrip, trip ? { tripId: trip._id } : 'skip');
  const { add, confirmRemove } = usePlaceActions(trip?._id);
  const savedPlace = place && saved?.find((p) => p.providerPlaceId === place.providerPlaceId);

  return (
    <View className="flex-row gap-2">
      {trip ? (
        <Button
          disabled={place === undefined}
          className={cn(
            'flex-1',
            savedPlace
              ? 'bg-purple-600 active:bg-purple-700'
              : 'bg-orange-500 active:bg-orange-600',
          )}
          onPress={() => {
            if (savedPlace) confirmRemove(savedPlace);
            else if (place) void add(place);
          }}
        >
          <Icon as={savedPlace ? CheckIcon : PlusIcon} className="size-4 text-white" />
          <Text className="text-white">{savedPlace ? 'In your trip' : 'Add to trip'}</Text>
        </Button>
      ) : null}
      <Button
        variant="outline"
        className="flex-1"
        disabled={!place?.googleMapsUrl}
        onPress={() => openLink(place?.googleMapsUrl ?? '')}
      >
        <Icon as={NavigationIcon} className="size-4" />
        <Text>Directions</Text>
      </Button>
    </View>
  );
}
