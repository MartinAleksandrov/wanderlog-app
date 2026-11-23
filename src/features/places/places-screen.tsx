import { Text } from '@/components/ui/text';
import { NoTripState } from '@/features/trips';
import { errorMessage } from '@/lib/error-message';
import type { Doc } from '@convex/_generated/dataModel';
import type { SuggestedPlace } from '@convex/googlePlaces';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlaceCard, type PlaceInfo } from './components/place-card';
import { useTripPlaces } from './trip-places';
import { usePlaceActions } from './use-place-actions';

// One card: what to show, plus the saved row and/or the Google suggestion behind it
type Row = { key: string; info: PlaceInfo; saved?: Doc<'places'>; suggestion?: SuggestedPlace };

// The third tab: the same places as the map, as a list with photos and details.
// "In your trip" first, then the suggestions that aren't saved yet.
export function PlacesScreen() {
  const router = useRouter();
  const { trip, saved, suggestions } = useTripPlaces();
  const { add, confirmRemove } = usePlaceActions(trip?._id);

  // The pop-up with more details. Name and photo go along so its top shows at once.
  function openDetails(row: Row) {
    const placeId = row.suggestion?.providerPlaceId ?? row.saved?.providerPlaceId;
    if (placeId === undefined) return;
    router.push({
      pathname: '/place/[placeId]',
      params: { placeId, name: row.info.name, photoName: row.info.photoName ?? '' },
    });
  }

  if (trip === undefined) {
    return <ActivityIndicator className="flex-1 bg-background" />;
  }
  if (trip === null) {
    return (
      <View className="flex-1 justify-center bg-background p-6">
        <NoTripState message="Pick a city to see its museums, landmarks and parks here." />
      </View>
    );
  }

  const suggestionById = new Map(suggestions.data?.map((place) => [place.providerPlaceId, place]));
  const savedIds = new Set(saved?.map((place) => place.providerPlaceId));
  const sections = [
    {
      title: 'In your trip',
      data: (saved ?? []).map((place): Row => {
        const suggestion = place.providerPlaceId
          ? suggestionById.get(place.providerPlaceId)
          : undefined;
        // Prefer the fresh Google details (rating, description) when the place is nearby
        return { key: place._id, info: suggestion ?? place, saved: place, suggestion };
      }),
    },
    {
      title: 'Suggested places',
      data: (suggestions.data ?? [])
        .filter((place) => !savedIds.has(place.providerPlaceId))
        .map((place): Row => ({ key: place.providerPlaceId, info: place, suggestion: place })),
    },
  ].filter((section) => section.data.length > 0);

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <SectionList
          sections={sections}
          keyExtractor={(row) => row.key}
          stickySectionHeadersEnabled={false}
          contentContainerClassName="gap-3 px-4 pb-10"
          ListHeaderComponent={
            <View className="gap-1 pt-4">
              <Text variant="h3">Places to visit</Text>
              <Text variant="muted">{trip.destination}</Text>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Text className="pt-3 text-sm font-semibold text-muted-foreground uppercase">
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <PlaceCard
              place={item.info}
              isSaved={item.saved !== undefined}
              onToggle={() => {
                if (item.saved) confirmRemove(item.saved);
                else if (item.suggestion) void add(item.suggestion);
              }}
              onPress={() => openDetails(item)}
            />
          )}
          ListFooterComponent={
            suggestions.isFetching ? (
              <ActivityIndicator className="py-6" />
            ) : suggestions.error ? (
              // Tap to search again (e.g. after the connection is back)
              <Pressable
                onPress={() => void suggestions.refetch()}
                className="items-center gap-1 py-6"
              >
                <Text className="text-center text-sm text-destructive">
                  {errorMessage(suggestions.error)}
                </Text>
                <Text className="text-sm font-semibold">Tap to try again</Text>
              </Pressable>
            ) : null
          }
        />
      </SafeAreaView>
    </View>
  );
}
