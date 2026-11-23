import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PlaneTakeoffIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExploreCard } from './components/explore-card';
import { MapSearchBar } from './components/map-search-bar';
import { MapStatus } from './components/map-status';
import { PinLayer } from './components/pin-layer';
import { PlacePreviewCard } from './components/place-preview-card';
import { useMapPlaces } from './use-map-places';

// The second tab: a Google map with places to visit as photo pins. Orange = suggested, purple =
// in your trip. Pins shrink to dots where they'd cover each other and grow back as you zoom in
// (pin-layout.ts). Tapping a pin opens its pop-up at the bottom (photos, rating, description,
// add or remove); tapping the map closes it. The search bar finds any city: the map flies
// there, shows its sights, and offers to plan a trip to it (use-explore-city.ts).
//
// Google's logo (bottom left) must stay visible: the pin pop-up floats above it, the hint for
// someone without a trip gets fixed room under the map via mapPadding, and other cards go at
// the top. The padding never changes while a map is shown: changing it cancels the map's fly-to.
export function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const {
    trip,
    explore,
    shown,
    shownArea,
    searchShownArea,
    title,
    initialRegion,
    pins,
    selectedKey,
    selected,
    select,
    addPin,
    removePin,
  } = useMapPlaces(mapRef);
  // What the map shows right now, updated when the user stops moving it
  const [region, setRegion] = useState<Region | null>(null);
  const [query, setQuery] = useState('');

  if (trip === undefined) {
    return <ActivityIndicator className="flex-1 bg-background" />;
  }

  const { exploring } = explore;

  return (
    <View className="flex-1 bg-background">
      <MapView
        ref={mapRef}
        // A new trip mounts a new map, so it opens on that trip's city
        key={trip?._id ?? 'no-trip'}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onRegionChangeComplete={setRegion}
        mapPadding={{ top: 0, right: 0, bottom: trip ? 0 : 100, left: 0 }}
        // Tapping a pin opens a pop-up; Android would also slide the map to the pin, which then
        // shows "Search this area" after every tap
        moveOnMarkerPress={false}
        toolbarEnabled={false}
        // Tapping the map (not a pin) closes the pop-up. iOS reports pin taps here too.
        onPress={(event) => {
          if (event.nativeEvent.action !== 'marker-press') select(null);
        }}
      >
        <PinLayer
          pins={pins}
          region={region ?? initialRegion}
          selectedKey={selectedKey}
          onSelect={select}
        />
      </MapView>

      {/* box-none: the overlay's empty space lets touches through to the map */}
      <SafeAreaView edges={['top']} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View pointerEvents="box-none" className="gap-2 p-3">
          <MapSearchBar
            value={query}
            isBusy={explore.isLocating}
            onChangeText={setQuery}
            onSelect={(destination) => {
              setQuery('');
              select(null);
              void explore.start(destination);
            }}
          />
          {/* The cards under the search bar make way for its results while typing */}
          {query === '' ? (
            <TopCards
              explore={explore}
              title={title}
              shown={shown}
              shownArea={shownArea}
              region={region}
              onSearchArea={searchShownArea}
            />
          ) : null}
        </View>
      </SafeAreaView>

      {trip === null && !exploring ? (
        <View className="absolute inset-x-3 bottom-3 flex-row items-center gap-3 rounded-2xl border border-border bg-background p-4 shadow-lg">
          <Icon as={PlaneTakeoffIcon} className="size-6 text-orange-500" />
          <Text className="flex-1">
            Search a city above to see its sights, then plan your first trip there.
          </Text>
        </View>
      ) : null}
      {trip && !selected ? (
        // Bottom right: Google's logo sits bottom left. The pin pop-up takes its place.
        <View className="absolute right-3 bottom-3 gap-1 rounded-lg bg-background/90 px-3 py-2">
          <Legend className="border-orange-500 bg-white" label="Suggested" />
          <Legend className="border-white bg-purple-600" label="In your trip" />
        </View>
      ) : null}
      {/* Hidden while typing in the search bar, so it doesn't sit on top of the keyboard */}
      {selected && query === '' ? (
        <PlacePreviewCard
          pin={selected}
          exploringCity={exploring?.destination.name}
          onAdd={() => addPin(selected)}
          onRemove={() => removePin(selected)}
          onPlanTrip={explore.planTrip}
          onClose={() => select(null)}
        />
      ) : null}
    </View>
  );
}

type MapPlaces = ReturnType<typeof useMapPlaces>;

// Under the search bar: the explored city (with "Plan trip"), then what the map shows and
// "Search this area"
function TopCards({
  explore,
  title,
  shown,
  shownArea,
  region,
  onSearchArea,
}: {
  explore: MapPlaces['explore'];
  title: string;
  shown: MapPlaces['shown'];
  shownArea: MapPlaces['shownArea'];
  region: Region | null;
  onSearchArea: MapPlaces['searchShownArea'];
}) {
  const { exploring } = explore;
  return (
    <>
      {exploring ? (
        <ExploreCard
          name={exploring.destination.name}
          region={exploring.destination.region}
          photoName={exploring.photoName}
          onPlanTrip={explore.planTrip}
          onClose={explore.stop}
        />
      ) : null}
      {shownArea ? (
        <MapStatus
          title={title}
          searchedArea={shownArea}
          region={region}
          placeCount={shown.data?.length ?? 0}
          isLoading={shown.isFetching}
          error={shown.error}
          onRetry={() => void shown.refetch()}
          onSearchArea={onSearchArea}
        />
      ) : null}
    </>
  );
}

// A small sample of each kind of pin, with what its colour means
function Legend({ className, label }: { className: string; label: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className={`size-3.5 rounded-full border-2 ${className}`} />
      <Text className="text-xs">{label}</Text>
    </View>
  );
}
