import { PlacePhoto } from '@/components/place-photo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDateRange } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { cn } from '@/lib/utils';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useRouter } from 'expo-router';
import { ChevronDownIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { StarRating } from './components/star-rating';
import { VisitedGlobe } from './components/visited-globe';
import { visitedWorld } from './world';

type PastTrip = FunctionReturnType<typeof api.journal.pastTrips>[number];

// The globe's largest size; on a narrow phone it fits the screen's width
const MAX_GLOBE_SIZE = 340;
// Countries in the world (UN members and observers), for "4% of the world"
const WORLD_COUNTRIES = 195;
// The covers stacked on the closed "Past trips" row, as a peek at what's inside
const PEEK_COVERS = 3;
// Photo widths asked of Google. The same ones as the journal page's cover and place cards, so a
// photo seen here is already cached there (and the other way round).
const COVER_WIDTH = 800;
const THUMB_WIDTH = 180;

// The account tab's travel part: the globe of where the user has been, the counts, and their past
// trips (folded away until tapped, so the tab stays short), each opening its journal page.
export function TravelSection() {
  const today = useToday();
  const pastTrips = useQuery(api.journal.pastTrips, { today });
  const { width } = useWindowDimensions();

  if (pastTrips === undefined) return <ActivityIndicator className="py-10" />;

  // Newest first, so the globe's intro ends on the latest trip's city
  const world = visitedWorld(pastTrips);
  const countryNames = [...world.countryNames];
  const share = Math.max(1, Math.round((countryNames.length / WORLD_COUNTRIES) * 100));

  return (
    <View className="gap-4">
      <Text variant="h4">Your world</Text>

      <View className="items-center gap-1">
        <VisitedGlobe
          countries={world.countries}
          home={world.cities[0]?.coordinates}
          size={Math.min(width - 32, MAX_GLOBE_SIZE)}
          accessibilityLabel={
            countryNames.length === 0
              ? 'A globe. Countries light up here once you have past trips.'
              : `A globe with the countries you've been to: ${countryNames.join(', ')}`
          }
        />
        <Text variant="muted" className="text-xs">
          Pinch or double-tap to zoom in
        </Text>
      </View>

      <View className="flex-row gap-3">
        <Stat
          value={countryNames.length}
          label={countryNames.length === 1 ? 'country' : 'countries'}
        />
        <Stat value={world.cities.length} label={world.cities.length === 1 ? 'city' : 'cities'} />
        <Stat value={pastTrips.length} label={pastTrips.length === 1 ? 'trip' : 'trips'} />
      </View>

      {countryNames.length > 0 ? (
        <Text variant="muted" className="text-center">
          {countryNames.join(' · ')}
          {'\n'}
          {share}% of the world so far
        </Text>
      ) : (
        <Text variant="muted" className="text-center">
          Your world fills in as you travel: each trip lights up its country once it&apos;s over,
          and you can write about it here.
        </Text>
      )}

      {pastTrips.length > 0 ? <PastTrips trips={pastTrips} /> : null}
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 items-center rounded-2xl border border-border bg-card py-3">
      <Text className="text-2xl font-bold">{value}</Text>
      <Text variant="muted">{label}</Text>
    </View>
  );
}

// A trip's cover: the city's photo, or (for a trip made without one) its first place's
function coverOf(trip: PastTrip): string | undefined {
  return trip.destinationPhotoName ?? trip.photos[0]?.photoName;
}

// The past trips behind one row: closed, it shows how many there are and a peek of their covers;
// a tap opens the list of cards below it (and another closes it).
function PastTrips({ trips }: { trips: PastTrip[] }) {
  const [open, setOpen] = useState(false);
  const covers = trips
    .flatMap((trip) => {
      const photoName = coverOf(trip);
      return photoName ? [{ tripId: trip._id, photoName }] : [];
    })
    .slice(0, PEEK_COVERS);

  return (
    <View className="gap-3">
      <Pressable
        onPress={() => setOpen((wasOpen) => !wasOpen)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? 'Hides your past trips' : 'Shows your past trips'}
        className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 active:bg-accent"
      >
        {covers.length > 0 ? (
          <View className="flex-row">
            {covers.map((cover, index) => (
              <PlacePhoto
                key={cover.tripId}
                photoName={cover.photoName}
                width={THUMB_WIDTH}
                className={cn('size-9 rounded-full border-2 border-card', index > 0 && '-ml-3')}
              />
            ))}
          </View>
        ) : null}
        <View className="flex-1">
          <Text className="font-semibold">Past trips</Text>
          <Text variant="muted" className="text-sm">
            {trips.length === 1 ? '1 trip' : `${trips.length} trips`} to look back on
          </Text>
        </View>
        {/* Turns to point up while open. A Reanimated CSS transition: it animates the change of
          the style by itself, on the UI thread. */}
        <Animated.View
          style={{
            transform: [{ rotate: open ? '180deg' : '0deg' }],
            transitionProperty: 'transform',
            transitionDuration: 200,
          }}
        >
          <Icon as={ChevronDownIcon} className="size-5 text-muted-foreground" />
        </Animated.View>
      </Pressable>

      {open ? (
        <View className="gap-3">
          {trips.map((trip, index) => (
            // The cards slide in one after another, the first few only
            <Animated.View
              key={trip._id}
              entering={FadeInDown.delay(Math.min(index, 5) * 50).duration(300)}
            >
              <PastTripCard trip={trip} />
            </Animated.View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// One past trip: the city's photo with the trip's name and dates on it, photos of the places
// saved to it, its stars, and the start of its journal story (or a nudge to write one). Opens
// the trip's journal page.
function PastTripCard({ trip }: { trip: PastTrip }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/journal/[tripId]', params: { tripId: trip._id } })}
      accessibilityRole="button"
      accessibilityLabel={`${trip.name}, ${formatDateRange(trip.startDate, trip.endDate)}`}
      className="overflow-hidden rounded-2xl border border-border bg-card active:opacity-80"
    >
      <View className="h-36">
        <PlacePhoto
          photoName={coverOf(trip)}
          width={COVER_WIDTH}
          className="size-full"
          iconClassName="size-10"
        />
        <View className="absolute inset-x-0 bottom-0 gap-0.5 bg-black/45 px-3 py-2">
          <Text className="text-lg font-semibold text-white" numberOfLines={1}>
            {trip.name}
          </Text>
          <Text className="text-xs text-white/85" numberOfLines={1}>
            {formatDateRange(trip.startDate, trip.endDate)}
          </Text>
        </View>
      </View>

      <View className="gap-2.5 p-3">
        {trip.photos.length > 0 ? (
          <PlacePhotos photos={trip.photos} placeCount={trip.placeCount} />
        ) : null}
        {trip.rating !== undefined ? <StarRating value={trip.rating} size="sm" /> : null}
        {trip.journal ? (
          <Text variant="muted" numberOfLines={2} className="italic">
            {trip.journal}
          </Text>
        ) : trip.role !== 'viewer' ? (
          // Viewers can't write in the journal, so they aren't asked to
          <Text variant="muted" className="text-blue-600 dark:text-blue-400">
            Write about this trip
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// A row of the trip's place photos. When the trip has more places than photos shown, the last
// photo is dimmed and says how many more there are ("+4").
function PlacePhotos({ photos, placeCount }: { photos: PastTrip['photos']; placeCount: number }) {
  const hidden = placeCount - photos.length;
  // The last photo makes way for the count, so its place counts as hidden too
  const more = hidden > 0 ? hidden + 1 : 0;
  const named = (more > 0 ? photos.slice(0, -1) : photos).map((photo) => photo.name);

  return (
    <View
      className="flex-row gap-2"
      accessible
      accessibilityLabel={`Places: ${named.join(', ')}${more > 0 ? ` and ${more} more` : ''}`}
    >
      {photos.map((photo, index) => (
        // flex-1 with a cap: five photos share a narrow phone's width, two don't grow huge
        <View key={photo._id} className="aspect-square max-w-16 flex-1 overflow-hidden rounded-xl">
          <PlacePhoto photoName={photo.photoName} width={THUMB_WIDTH} className="size-full" />
          {more > 0 && index === photos.length - 1 ? (
            <View className="absolute inset-0 items-center justify-center bg-black/55">
              <Text className="font-semibold text-white">+{more}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
