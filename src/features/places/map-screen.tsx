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
import { ModeSwitch } from './components/mode-switch';
import { PinLayer } from './components/pin-layer';
import { PlacePreviewCard } from './components/place-preview-card';
import { usePlaceMode } from './place-mode-context';
import type { PlaceMode } from './place-modes';
import { useMapPlaces } from './use-map-places';

// The second tab: a Google map with places as photo pins, for the side switched on under the
// search bar: sights (orange suggestions, purple trip places, Google's normal map) or sweet
// spots (pink suggestions, chocolate saved spots, a cream map; see place-modes.tsx). Pins
// shrink to dots where they'd cover each other and grow back as you zoom in (pin-layout.ts).
// Tapping a pin opens its pop-up at the bottom (photos, rating, description, save or remove,
// directions); tapping the map closes it. The search bar finds any city: the map flies there,
// shows its places, and offers to plan a trip to it (use-explore-city.ts).
//
// Google's logo (bottom left) must stay visible: the pin pop-up floats above it, the hint for
// someone without a trip gets fixed room under the map via mapPadding, and other cards go at
// the top. The padding never changes while a map is shown: changing it cancels the map's fly-to.
export function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const { mode, setKind } = usePlaceMode();
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
        // Sweet spots get a warm cream map without Google's own shop icons
        customMapStyle={mode.mapStyle}
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
          kind={mode.kind}
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
          {/* The switch and cards under the search bar make way for its results while typing */}
          {query === '' ? (
            <>
              <ModeSwitch
                kind={mode.kind}
                onChange={(kind) => {
                  // The open pop-up belongs to the other side's pins
                  select(null);
                  setKind(kind);
                }}
              />
              <TopCards
                explore={explore}
                title={title}
                countLabel={mode.count(shown.data?.length ?? 0)}
                shown={shown}
                shownArea={shownArea}
                region={region}
                onSearchArea={searchShownArea}
              />
            </>
          ) : null}
        </View>
      </SafeAreaView>

      {trip === null && !exploring ? (
        <View className="absolute inset-x-3 bottom-3 flex-row items-center gap-3 rounded-2xl border border-border bg-background p-4 shadow-lg">
          <Icon as={PlaneTakeoffIcon} className="size-6 text-orange-500" />
          <Text className="flex-1">
            Search a city above to see its {mode.label.toLowerCase()}, then plan your first trip
            there.
          </Text>
        </View>
      ) : null}
      {/* Bottom right: Google's logo sits bottom left. The pin pop-up takes its place. */}
      {trip && !selected ? <MapLegend mode={mode} /> : null}
      {/* Hidden while typing in the search bar, so it doesn't sit on top of the keyboard */}
      {selected && query === '' ? (
        <PlacePreviewCard
          pin={selected}
          mode={mode}
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
  countLabel,
  shown,
  shownArea,
  region,
  onSearchArea,
}: {
  explore: MapPlaces['explore'];
  title: string;
  // "20 places" / "14 sweet spots"
  countLabel: string;
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
          countLabel={countLabel}
          isLoading={shown.isFetching}
          error={shown.error}
          onRetry={() => void shown.refetch()}
          onSearchArea={onSearchArea}
        />
      ) : null}
    </>
  );
}

// What the two pin colours mean, for the side that's switched on
function MapLegend({ mode }: { mode: PlaceMode }) {
  return (
    <View className="absolute right-3 bottom-3 gap-1 rounded-lg bg-background/90 px-3 py-2">
      <Legend className={mode.legend.suggested} label="Suggested" />
      <Legend className={mode.legend.saved} label={mode.savedTitle} />
    </View>
  );
}

// A small sample of one kind of pin, with what its colour means
function Legend({ className, label }: { className: string; label: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className={`size-3.5 rounded-full border-2 ${className}`} />
      <Text className="text-xs">{label}</Text>
    </View>
  );
}
