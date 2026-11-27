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
import type { PlaceKind } from '@convex/schema';
import { useRouter } from 'expo-router';
import { ExpandIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeInLeft, FadeInRight, LayoutAnimationConfig } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackToTopButton } from './components/back-to-top-button';
import { CrawlCard } from './components/crawl-card';
import { FilterChips } from './components/filter-chips';
import type { CrawlSpot } from './crawl';
import { LocationPrompt } from './components/location-prompt';
import { ModeSwitch } from './components/mode-switch';
import { PlaceCard, type PlaceInfo } from './components/place-card';
import { SortChips, SortNote } from './components/sort-chips';
import { isOpen, openStatus, type OpenStatus } from './open-status';
import { placeDetailsHref } from './place-details-href';
import { passesFilters } from './place-filters';
import { usePlaceMode } from './place-mode-context';
import type { PlaceMode } from './place-modes';
import { sortPlaces, type PlaceSort } from './place-ranking';
import { FEW_PLACES, widerSearchArea } from './map-area';
import { sideAfterSwipe, stepBetween } from './side-swipe';
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

// "Back to top" shows once the list is scrolled this far down (in dp): past the banner, the chips
// and a card or two
const BACK_TO_TOP_AFTER = 600;

// The third tab: the same places as the map, as a list with photos and details, for the side
// switched on at the top (sights, sweet spots or restaurants) and the filters picked (kind and
// "Open now", shared with the map). Saved ones first, then the 30 suggestions that aren't saved
// yet. Both lists go top rated first (the one more people rated breaks a tie), or most reviewed
// first, or (in the city) closest first, picked with the sort chips; the pick stays when
// switching sides. In the city, each card says how far away it is. Swiping left or right on the
// list switches to the next or previous side, like pages; the switch stays above the list. Once
// scrolled down, a button at the bottom right goes back to the top.
export function PlacesScreen() {
  const router = useRouter();
  const { mode, setKind, filter, setFilterId, openNow, setOpenNow } = usePlaceMode();
  const { trip, area, saved, suggestions, searchArea } = useTripPlaces();
  const { add, confirmRemove } = usePlaceActions(trip?._id, mode.kind);
  const location = useMyLocation();
  const distanceTo = useDistanceTo(area);
  const now = useNow();
  const swipe = useSideSwipe(mode.kind, setKind);
  const slideStep = useSlideStep(mode.kind);
  const listRef = useRef<SectionList<Row>>(null);
  const backToTop = useBackToTop(mode.kind);
  const [pickedSort, setSort] = useState<PlaceSort>('rating');

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
        <NoTripState message="Pick a city to see its museums, landmarks, cafes and restaurants here." />
      </View>
    );
  }

  const { savedRows, suggestedRows } = toRows(saved ?? [], suggestions.data ?? [], now);
  const filters = { filter, openNow };
  const isInCity = distanceTo !== null;
  // Closest needs the distances: after leaving the city, top rated until it's back
  const sort = pickedSort === 'distance' && !isInCity ? 'rating' : pickedSort;
  // The filtered places in the picked order, with their distances when in the city
  const inOrder = (rows: Row[]) => {
    const shown = rows.filter((row) => passesFilters(row, filters));
    const measured =
      distanceTo === null
        ? shown
        : shown.map((row) => ({ ...row, distance: distanceTo(row.info.coordinates) }));
    return sortPlaces(measured, sort);
  };
  const savedShown = inOrder(savedRows);
  const sections = [
    { title: mode.savedTitle, data: savedShown },
    { title: mode.suggestedTitle, data: inOrder(suggestedRows) },
  ].filter((section) => section.data.length > 0);
  const widerArea = area ? widerSearchArea(area) : null;

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ModeSwitch kind={mode.kind} onChange={setKind} className="mt-4 mb-1" />
        {/* The swipe works anywhere on the list. Scrolling it up or down, or scrolling the chips
            sideways, takes over the touch first, so those keep working as before. */}
        <GestureDetector gesture={swipe}>
          <View className="flex-1 overflow-hidden">
            {/* A new view for each side (the key), so the list starts at the top and fades in
                from the side it came from: from the right when moving on, from the left when
                going back. Not when the tab first opens (skipEntering). */}
            <LayoutAnimationConfig skipEntering>
              <Animated.View
                key={mode.kind}
                entering={(slideStep === 1 ? FadeInRight : FadeInLeft).duration(200)}
                className="flex-1"
              >
                <SectionList
                  ref={listRef}
                  sections={sections}
                  onScroll={backToTop.onScroll}
                  // Where the list is, about 10 times a second: plenty for showing the button
                  scrollEventThrottle={100}
                  keyExtractor={(row) => row.key}
                  stickySectionHeadersEnabled={false}
                  // Every card on the list asks for its photo, and each one is a paid Google
                  // request, so only the cards near the screen are on it: what's shown plus 2
                  // screens' worth above and below (windowSize 5, counted in screens; the
                  // default 21 put every card of a 30-place search on the list as soon as the tab
                  // opened). Those 2 screens ahead (about 5 cards) are why photos are already
                  // there when someone scrolls at a reading pace: each card starts loading well
                  // before it scrolls into view. The first render covers the first screen (the
                  // section title counts as an item).
                  initialNumToRender={4}
                  windowSize={5}
                  contentContainerClassName="gap-3 px-4 pb-10"
                  ListHeaderComponent={
                    <View className="gap-3 pt-3">
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
                      {savedRows.length + suggestedRows.length > 0 ? (
                        <SortChips
                          mode={mode}
                          sort={sort}
                          isInCity={isInCity}
                          onChange={setSort}
                          className="-mx-4"
                          contentClassName="px-4 py-1"
                        />
                      ) : null}
                      <CrawlCard
                        mode={mode}
                        spots={crawlSpots(savedShown, isInCity)}
                        start={isInCity ? location.coords : null}
                      />
                    </View>
                  }
                  renderSectionHeader={({ section }) => (
                    <View className="flex-row items-center justify-between gap-2 pt-3">
                      <Text className="text-sm font-semibold text-muted-foreground uppercase">
                        {section.title}
                      </Text>
                      <SortNote sort={sort} />
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
              </Animated.View>
            </LayoutAnimationConfig>
            {backToTop.isShown ? (
              <BackToTopButton
                onPress={() =>
                  listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true })
                }
              />
            ) : null}
          </View>
        </GestureDetector>
      </SafeAreaView>
    </View>
  );
}

// The sideways swipe on the list. It starts only once the finger has moved 24 dp sideways, and
// gives up when it moves 16 dp up or down first, so scrolling the list isn't taken for a swipe.
// When the finger lifts, sideAfterSwipe decides whether it was far or fast enough to switch.
// runOnJS: the callback changes React state, so it runs on the JS thread instead of the UI
// thread (where Gesture Handler runs callbacks by default, for animations).
function useSideSwipe(kind: PlaceKind, setKind: (kind: PlaceKind) => void) {
  return usePanGesture({
    activeOffsetX: [-24, 24],
    failOffsetY: [-16, 16],
    runOnJS: true,
    onDeactivate: (event) => {
      // Canceled: something else took the touch (the list or the chips started scrolling)
      if (event.canceled) return;
      const next = sideAfterSwipe(kind, event.translationX, event.velocityX);
      if (next !== kind) setKind(next);
    },
  });
}

// Which way the side shown now came from (1: a later side, -1: an earlier one), so its list fades
// in from that side. The side shown before is state, updated during render when the side changes
// (React's pattern for "adjust state when a prop changes"): React renders again right away, before
// anything reaches the screen, so the new list mounts with the right direction.
function useSlideStep(kind: PlaceKind): 1 | -1 {
  const [slide, setSlide] = useState<{ kind: PlaceKind; step: 1 | -1 }>({ kind, step: 1 });
  if (slide.kind !== kind) {
    const next = { kind, step: stepBetween(slide.kind, kind) };
    setSlide(next);
    return next.step;
  }
  return slide.step;
}

// Whether to show "Back to top": while the list is scrolled more than BACK_TO_TOP_AFTER down, so
// it goes away by itself on the way back up. Each side has its own list, which opens at the top,
// so switching sides hides it. That's adjusted during render, like useSlideStep above.
function useBackToTop(kind: PlaceKind) {
  const [state, setState] = useState({ kind, isShown: false });
  if (state.kind !== kind) {
    setState({ kind, isShown: false });
  }
  return {
    isShown: state.kind === kind && state.isShown,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const isShown = event.nativeEvent.contentOffset.y > BACK_TO_TOP_AFTER;
      // Only when it changes, not on every scroll event
      if (isShown !== state.isShown) setState({ kind, isShown });
    },
  };
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

// The crawl picks from the saved places the list shows (so the chips narrow it too: a dessert
// crawl, a museum walk). In the city the crawl is for now, so places known to be closed are left
// out.
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
