import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NoTripState } from '@/features/trips';
import { errorMessage } from '@/lib/error-message';
import { cn } from '@/lib/utils';
import type { Doc } from '@convex/_generated/dataModel';
import type { SuggestedPlace } from '@convex/googlePlaces';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModeSwitch } from './components/mode-switch';
import { PlaceCard, type PlaceInfo } from './components/place-card';
import { usePlaceMode } from './place-mode-context';
import type { PlaceMode } from './place-modes';
import { useTripPlaces } from './trip-places';
import { usePlaceActions } from './use-place-actions';

// One card: what to show, plus the saved row and/or the Google suggestion behind it
type Row = { key: string; info: PlaceInfo; saved?: Doc<'places'>; suggestion?: SuggestedPlace };

// The third tab: the same places as the map, as a list with photos and details, for the side
// switched on at the top (sights or sweet spots). Saved ones first, then the suggestions that
// aren't saved yet.
export function PlacesScreen() {
  const router = useRouter();
  const { mode, setKind } = usePlaceMode();
  const { trip, saved, suggestions } = useTripPlaces();
  const { add, confirmRemove } = usePlaceActions(trip?._id, mode.kind);

  // The pop-up with more details. Name and photo go along so its top shows at once, and the
  // side, so its button saves to the same list.
  function openDetails(row: Row) {
    const placeId = row.suggestion?.providerPlaceId ?? row.saved?.providerPlaceId;
    if (placeId === undefined) return;
    router.push({
      pathname: '/place/[placeId]',
      params: {
        placeId,
        name: row.info.name,
        photoName: row.info.photoName ?? '',
        kind: mode.kind,
      },
    });
  }

  if (trip === undefined) {
    return <ActivityIndicator className="flex-1 bg-background" />;
  }
  if (trip === null) {
    return (
      <View className="flex-1 justify-center bg-background p-6">
        <NoTripState message="Pick a city to see its museums, landmarks, cafes and bakeries here." />
      </View>
    );
  }

  const suggestionById = new Map(suggestions.data?.map((place) => [place.providerPlaceId, place]));
  const savedIds = new Set(saved?.map((place) => place.providerPlaceId));
  const sections = [
    {
      title: mode.savedTitle,
      data: (saved ?? []).map((place): Row => {
        const suggestion = place.providerPlaceId
          ? suggestionById.get(place.providerPlaceId)
          : undefined;
        // Prefer the fresh Google details (rating, description) when the place is nearby
        return { key: place._id, info: suggestion ?? place, saved: place, suggestion };
      }),
    },
    {
      title: mode.suggestedTitle,
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
            <View className="gap-3 pt-4">
              <ModeSwitch kind={mode.kind} onChange={setKind} />
              <ModeBanner mode={mode} destination={trip.destination} />
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
              mode={mode}
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

// The list's header: the side's icon in its colour, its title, the trip's city and what the
// side shows ("Bakeries, cafes, brunch and desserts rated above 4.0 by 50+ people")
function ModeBanner({ mode, destination }: { mode: PlaceMode; destination: string }) {
  return (
    <View className={cn('flex-row items-center gap-3 rounded-3xl p-4', mode.banner)}>
      <View className={cn('size-12 items-center justify-center rounded-2xl', mode.bannerIcon)}>
        <Icon as={mode.icon} className="size-6 text-white" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="h4">{mode.title}</Text>
        <Text className="font-medium">{destination}</Text>
        <Text variant="muted" className="text-xs">
          {mode.tagline}
        </Text>
      </View>
    </View>
  );
}
