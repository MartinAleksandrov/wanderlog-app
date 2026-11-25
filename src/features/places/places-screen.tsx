import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NoTripState } from '@/features/trips';
import { errorMessage } from '@/lib/error-message';
import { useMyLocation } from '@/lib/my-location';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';
import type { Doc } from '@convex/_generated/dataModel';
import type { SuggestedPlace } from '@convex/googlePlaces';
import { useRouter } from 'expo-router';
import { ExpandIcon, NavigationIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CrawlCard } from './components/crawl-card';
import { FilterChips } from './components/filter-chips';
import type { CrawlSpot } from './crawl';
import { LocationPrompt } from './components/location-prompt';
import { ModeSwitch } from './components/mode-switch';
import { PlaceCard, type PlaceInfo } from './components/place-card';
import { isOpen, openStatus, type OpenStatus } from './open-status';
import { placeDetailsHref } from './place-details-href';
import { passesFilters } from './place-filters';
import { usePlaceMode } from './place-mode-context';
import type { PlaceMode } from './place-modes';
import { FEW_PLACES, widerSearchArea } from './map-area';
import { useTripPlaces } from './trip-places';
import { useDistanceTo } from './use-distance';
import { usePlaceActions } from './use-place-actions';

// One card: what to show, plus the saved row and/or the Google suggestion behind it, whether
// it's open now, and how far it is from the phone (metres, when known)
type Row = {
  key: string;
  info: PlaceInfo;
  saved?: Doc<'places'>;
  suggestion?: SuggestedPlace;
  category?: string;
  status: OpenStatus | null;
  isOpen: boolean;
  distance?: number;
};

// The third tab: the same places as the map, as a list with photos and details, for the side
// switched on at the top (sights or sweet spots) and the filters picked (kind and "Open now",
// shared with the map). Saved ones first, then the suggestions that aren't saved yet. In the
// city, each card says how far away it is and both lists go closest first; otherwise Google's
// order (most popular first).
export function PlacesScreen() {
  const router = useRouter();
  const { mode, setKind, filter, setFilterId, openNow, setOpenNow } = usePlaceMode();
  const { trip, area, saved, suggestions, searchArea } = useTripPlaces();
  const { add, confirmRemove } = usePlaceActions(trip?._id, mode.kind);
  const location = useMyLocation();
  const distanceTo = useDistanceTo(area);
  const now = useNow();

  // The pop-up with more details. Name and photo go along so its top shows at once, and the
  // side, so its button saves to the same list.
  function openDetails(row: Row) {
    const placeId = row.suggestion?.providerPlaceId ?? row.saved?.providerPlaceId;
    if (placeId === undefined) return;
    router.push(
      placeDetailsHref({
        placeId,
        name: row.info.name,
        photoName: row.info.photoName,
        kind: mode.kind,
      }),
    );
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

  const { savedRows, suggestedRows } = toRows(saved ?? [], suggestions.data ?? [], now);
  const filters = { filter, openNow };
  // Closest first when distances are known; otherwise the backend's order (most reviewed first)
  const inOrder = (rows: Row[]) => {
    const shown = rows.filter((row) => passesFilters(row, filters));
    if (distanceTo === null) return shown;
    return shown
      .map((row) => ({ ...row, distance: distanceTo(row.info.coordinates) }))
      .sort((a, b) => a.distance - b.distance);
  };
  const savedShown = inOrder(savedRows);
  const sections = [
    { title: mode.savedTitle, data: savedShown },
    { title: mode.suggestedTitle, data: inOrder(suggestedRows) },
  ].filter((section) => section.data.length > 0);
  const widerArea = area ? widerSearchArea(area) : null;
  const isInCity = distanceTo !== null;

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
              {location.access === 'ask' ? (
                <LocationPrompt onPress={() => void location.enable()} />
              ) : null}
              <FilterChips
                mode={mode}
                places={[...savedRows, ...suggestedRows]}
                filters={filters}
                onSelect={setFilterId}
                onOpenNowChange={setOpenNow}
                // Full width, so the chips scroll from edge to edge
                className="-mx-4"
                contentClassName="px-4 py-1"
              />
              {mode.kind === 'sweet' ? (
                <CrawlCard
                  mode={mode}
                  spots={crawlSpots(savedShown, isInCity)}
                  start={isInCity ? location.coords : null}
                />
              ) : null}
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View className="flex-row items-center justify-between gap-2 pt-3">
              <Text className="text-sm font-semibold text-muted-foreground uppercase">
                {section.title}
              </Text>
              {distanceTo ? (
                <View className="flex-row items-center gap-1">
                  <Icon as={NavigationIcon} className="size-3 text-blue-600" />
                  <Text className="text-xs font-medium text-blue-600">Closest first</Text>
                </View>
              ) : null}
            </View>
          )}
          renderItem={({ item }) => (
            <PlaceCard
              place={item.info}
              mode={mode}
              isSaved={item.saved !== undefined}
              distance={item.distance}
              openStatus={item.status}
              onToggle={() => {
                if (item.saved) confirmRemove(item.saved);
                else if (item.suggestion) void add(item.suggestion);
              }}
              onPress={() => openDetails(item)}
            />
          )}
          ListFooterComponent={
            <ListFooter
              mode={mode}
              suggestions={suggestions}
              onSearchWider={widerArea ? () => searchArea(widerArea) : undefined}
              widerKm={widerArea ? Math.round(widerArea.widthMeters / 1000) : 0}
            />
          }
        />
      </SafeAreaView>
    </View>
  );
}

// The list's cards: the saved places (with Google's fresh details when they're in the searched
// area), then the suggestions that aren't saved yet, each with whether it's open at `now`
function toRows(saved: Doc<'places'>[], suggestions: SuggestedPlace[], now: number) {
  const suggestionById = new Map(suggestions.map((place) => [place.providerPlaceId, place]));
  const savedIds = new Set(saved.map((place) => place.providerPlaceId));
  const toRow = (row: Pick<Row, 'key' | 'info' | 'saved' | 'suggestion'>): Row => {
    const status = openStatus(row.info.hours, now);
    return { ...row, category: row.info.category, status, isOpen: isOpen(status) };
  };
  return {
    savedRows: saved.map((place) => {
      const suggestion = place.providerPlaceId
        ? suggestionById.get(place.providerPlaceId)
        : undefined;
      // Prefer the fresh Google details (rating, description, hours) when the place is nearby
      return toRow({ key: place._id, info: suggestion ?? place, saved: place, suggestion });
    }),
    suggestedRows: suggestions
      .filter((place) => !savedIds.has(place.providerPlaceId))
      .map((place) => toRow({ key: place.providerPlaceId, info: place, suggestion: place })),
  };
}

// The sweet-spot crawl picks from the saved spots the list shows (so the chips narrow it too: a
// dessert crawl). In the city the crawl is for now, so spots known to be closed are left out.
function crawlSpots(rows: Row[], isInCity: boolean): CrawlSpot[] {
  return rows
    .filter((row) => !isInCity || row.status?.tone !== 'closed')
    .map((row) => ({
      key: row.key,
      name: row.info.name,
      coordinates: row.info.coordinates,
      providerPlaceId: row.info.providerPlaceId,
      rating: row.info.rating,
    }));
}

// Under the list: a spinner while searching; the error with "Tap to try again" when the search
// failed; and when a small town has few places, the offer to search twice as far around
function ListFooter({
  mode,
  suggestions,
  onSearchWider,
  widerKm,
}: {
  mode: PlaceMode;
  suggestions: ReturnType<typeof useTripPlaces>['suggestions'];
  onSearchWider?: () => void;
  widerKm: number;
}) {
  const count = suggestions.data?.length ?? 0;
  if (suggestions.isFetching) return <ActivityIndicator className="py-6" />;
  if (suggestions.error) {
    return (
      // Tap to search again (e.g. after the connection is back)
      <Pressable onPress={() => void suggestions.refetch()} className="items-center gap-1 py-6">
        <Text className="text-center text-sm text-destructive">
          {errorMessage(suggestions.error)}
        </Text>
        <Text className="text-sm font-semibold">Tap to try again</Text>
      </Pressable>
    );
  }
  if (count >= FEW_PLACES || onSearchWider === undefined) return null;
  return (
    <View className="items-center gap-3 rounded-2xl border border-dashed border-border p-5">
      <Text variant="muted" className="text-center">
        Only {mode.count(count)} around here.
      </Text>
      <Button variant="outline" onPress={onSearchWider}>
        <Icon as={ExpandIcon} className="size-4" />
        <Text>Search {widerKm} km wide</Text>
      </Button>
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
