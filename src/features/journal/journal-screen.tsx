import { PlacePhoto } from '@/components/place-photo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PLACE_KINDS, PLACE_MODES } from '@/features/places';
import { formatDateRange } from '@/lib/dates';
import { showError } from '@/lib/error-message';
import { api } from '@convex/_generated/api';
import { PLACE_NOTES_MAX_LENGTH, TRIP_JOURNAL_MAX_LENGTH } from '@convex/lib/limits';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { CheckIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, SectionList, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { JournalNote } from './components/journal-note';
import { StarRating } from './components/star-rating';
import { cityName } from './world';

type Journal = NonNullable<FunctionReturnType<typeof api.journal.forTrip>>;
type JournalPlace = Journal['places'][number];

// The cards slide up one after another when the page opens, but only the first few wait their
// turn: a trip with 30 places shouldn't take seconds to finish appearing
const CARD_STAGGER_MS = 60;
const MAX_STAGGERED_CARDS = 8;

// A trip's journal page (/journal/<trip ID>, opened from the account tab's past trips): stars and
// a story for the whole city, then each saved place with its own stars and note. Everything saves
// itself as the user types or taps.
export function JournalScreen() {
  // A plain string from the URL; journal.forTrip checks that it's a trip ID
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const journal = useQuery(api.journal.forTrip, { tripId });

  if (journal === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text variant="muted">This trip no longer exists.</Text>
      </View>
    );
  }
  if (journal === undefined) return <ActivityIndicator className="flex-1 bg-background" />;
  return <JournalPage trip={journal.trip} places={journal.places} />;
}

function JournalPage({ trip, places }: Journal) {
  // Optimistic: tapped stars fill in at once (and pop) instead of after a server round trip. The
  // notes too: a card that scrolls away while its note is being saved, and is drawn again before
  // the server answers, starts from the text that was sent, not the one before it.
  const saveTrip = useMutation(api.journal.saveTrip).withOptimisticUpdate((store, args) => {
    const query = { tripId: args.tripId };
    const current = store.getQuery(api.journal.forTrip, query);
    if (!current) return;
    store.setQuery(api.journal.forTrip, query, {
      ...current,
      trip: {
        ...current.trip,
        ...(args.rating !== undefined && { rating: args.rating ?? undefined }),
        ...(args.journal !== undefined && { journal: asSaved(args.journal) }),
      },
    });
  });
  const savePlace = useMutation(api.journal.savePlace).withOptimisticUpdate((store, args) => {
    const query = { tripId: trip._id };
    const current = store.getQuery(api.journal.forTrip, query);
    if (!current) return;
    store.setQuery(api.journal.forTrip, query, {
      ...current,
      places: current.places.map((place) =>
        place._id === args.placeId
          ? {
              ...place,
              ...(args.rating !== undefined && { rating: args.rating ?? undefined }),
              ...(args.notes !== undefined && { notes: asSaved(args.notes) }),
            }
          : place,
      ),
    });
  });
  // Only the cards on screen when the page opens slide in. The list draws the others as they
  // scroll into view (and again after they've been far away): those must appear at once, not
  // fade in late. The list's first layout comes after those first cards are drawn.
  const [isOpening, setIsOpening] = useState(true);
  // The keyboard covers the bottom of the window, but this screen starts below the header:
  // KeyboardAvoidingView needs the header's height to make the right amount of room
  const headerHeight = useHeaderHeight();
  const canEdit = trip.role !== 'viewer';
  const city = cityName(trip.destination);

  function rateTrip(rating: number | null) {
    void saveTrip({ tripId: trip._id, rating }).catch((error: unknown) =>
      showError("Couldn't save the stars", error),
    );
  }

  // The sides that have places, in the switch's order (sights, sweet spots, restaurants). Within
  // a side, the places ticked off on the plan come first.
  const sections = PLACE_KINDS.map((kind) => ({
    mode: PLACE_MODES[kind],
    data: places
      .filter((place) => place.kind === kind)
      .sort((a, b) => Number(b.visited) - Number(a.visited)),
  })).filter((section) => section.data.length > 0);
  // Each card's wait before it slides in, in the order they're shown
  const delayOf = new Map<string, number>();
  for (const place of sections.flatMap((section) => section.data)) {
    delayOf.set(place._id, Math.min(delayOf.size, MAX_STAGGERED_CARDS) * CARD_STAGGER_MS);
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
      className="flex-1 bg-background"
    >
      <Stack.Screen options={{ title: trip.name }} />
      {/* A SectionList, not a ScrollView: it only draws the cards near the screen, so a trip with
        many places (each with a text field) stays quick. The city's part is its header. */}
      <SectionList
        sections={sections}
        keyExtractor={(place) => place._id}
        contentContainerClassName="p-4 pb-12"
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        onLayout={() => setIsOpening(false)}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.duration(400)} className="gap-4 pb-2">
            <View className="h-44 overflow-hidden rounded-2xl">
              {/* The city's photo, or (for a trip made without one) the first place's */}
              <PlacePhoto
                photoName={
                  trip.destinationPhotoName ?? places.find((place) => place.photoName)?.photoName
                }
                width={800}
                className="size-full"
                iconClassName="size-12"
              />
              <View className="absolute inset-x-0 bottom-0 gap-0.5 bg-black/45 px-4 py-3">
                <Text className="text-xl font-semibold text-white">{trip.destination}</Text>
                <Text className="text-sm text-white/85">
                  {formatDateRange(trip.startDate, trip.endDate)}
                </Text>
              </View>
            </View>

            <View className="gap-3 rounded-2xl border border-border bg-card p-4">
              <Text variant="large">How was {city}?</Text>
              <StarRating value={trip.rating} onChange={canEdit ? rateTrip : undefined} />
              <JournalNote
                savedText={trip.journal}
                placeholder={`What you'll want to remember about ${city}: the food, the people, the best day…`}
                maxLength={TRIP_JOURNAL_MAX_LENGTH}
                editable={canEdit}
                onSave={(journal) => saveTrip({ tripId: trip._id, journal })}
                className="h-36"
              />
            </View>
          </Animated.View>
        }
        ListEmptyComponent={
          <Text variant="muted" className="pt-4 text-center">
            No places were saved to this trip, so there&apos;s nothing to write about one by one.
          </Text>
        }
        renderSectionHeader={({ section }) => (
          <View className="flex-row items-center gap-2 pt-4 pb-3">
            <Icon as={section.mode.icon} className="size-5 text-foreground" />
            <Text variant="large" className="flex-1">
              {section.mode.label}
            </Text>
            <Text variant="muted">{section.mode.count(section.data.length)}</Text>
          </View>
        )}
        renderItem={({ item: place }) => (
          <Animated.View
            entering={
              isOpening ? FadeInDown.delay(delayOf.get(place._id) ?? 0).duration(350) : undefined
            }
            className="pb-3"
          >
            <PlaceEntry
              place={place}
              canEdit={canEdit}
              onSave={(change) => savePlace({ placeId: place._id, ...change })}
            />
          </Animated.View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

// One place's card: photo, name, whether it was ticked off on the plan, its stars and its note
function PlaceEntry({
  place,
  canEdit,
  onSave,
}: {
  place: JournalPlace;
  canEdit: boolean;
  onSave: (change: { notes?: string; rating?: number | null }) => Promise<unknown>;
}) {
  return (
    <View className="gap-3 rounded-2xl border border-border bg-card p-3">
      <View className="flex-row items-center gap-3">
        <PlacePhoto
          photoName={place.photoName}
          category={place.category}
          width={180}
          className="size-14 rounded-lg"
        />
        <View className="flex-1 gap-0.5">
          <Text className="font-semibold" numberOfLines={1}>
            {place.name}
          </Text>
          {place.category ? (
            <Text variant="muted" numberOfLines={1}>
              {place.category}
            </Text>
          ) : null}
          {place.visited ? (
            <View className="flex-row items-center gap-1">
              <Icon as={CheckIcon} className="size-3.5 text-green-600 dark:text-green-400" />
              <Text className="text-xs font-medium text-green-700 dark:text-green-400">
                Been there
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <StarRating
        value={place.rating}
        onChange={
          canEdit
            ? (rating) =>
                void onSave({ rating }).catch((error: unknown) =>
                  showError("Couldn't save the stars", error),
                )
            : undefined
        }
      />
      <JournalNote
        savedText={place.notes}
        placeholder="Worth it? What to order, when to go…"
        maxLength={PLACE_NOTES_MAX_LENGTH}
        editable={canEdit}
        onSave={(notes) => onSave({ notes })}
        className="h-20"
      />
    </View>
  );
}

// A note as the backend will store it (see cleanText in convex/journal.ts): trimmed, and no note
// at all when it's empty
function asSaved(text: string): string | undefined {
  return text.trim() || undefined;
}
