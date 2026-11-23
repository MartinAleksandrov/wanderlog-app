import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PlaneTakeoffIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DayRouteCard } from './components/day-route-card';
import { DayRouteLayer } from './components/day-route-layer';
import { ExploreCard } from './components/explore-card';
import { FilterChips } from './components/filter-chips';
import { MapSearchBar } from './components/map-search-bar';
import { MapStatus } from './components/map-status';
import { ModeSwitch } from './components/mode-switch';
import { PinLayer } from './components/pin-layer';
import { PlacePreviewCard } from './components/place-preview-card';
import { usePlaceMode } from './place-mode-context';
import type { PlaceMode } from './place-modes';
import { FEW_PLACES } from './map-area';
import { useMapPlaces } from './use-map-places';
import { useMapRoute } from './use-map-route';
import { useRevealPin } from './use-reveal-pin';

// The second tab: a Google map with places as photo pins, for the side switched on under the
// search bar: sights (orange suggestions, purple trip places, Google's normal map) or sweet
// spots (pink suggestions, chocolate saved spots, a cream map; see place-modes.tsx). Filter
// chips narrow the pins to one kind (Coffee, Parks…). Pins shrink to dots where they'd cover
// each other and grow back as you zoom in (pin-layout.ts). Tapping a pin opens its pop-up at
// the bottom, sliding the map up first if the pop-up would cover the pin; tapping the map
// closes it. The search bar finds any city: the map flies there, shows its places, and offers
// to plan a trip to it (use-explore-city.ts).
//
// Opened from the plan tab with ?day=N, the map shows that day's stops as a numbered route
// instead (use-map-route.ts).
//
// Google's logo (bottom left) must stay visible: the pin pop-up floats above it, the hint for
// someone without a trip gets fixed room under the map via mapPadding, and other cards go at
// the top. The padding never changes while a map is shown: changing it cancels the map's fly-to.
export function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const { mode } = usePlaceMode();
  const places = useMapPlaces(mapRef);
  const { trip, explore, initialRegion, pins, selectedKey, selected, select } = places;
  const revealPin = useRevealPin(mapRef);
  const route = useMapRoute(mapRef, () => select(null));
  // What the map shows right now, updated when it stops moving (sizes the pins)
  const [region, setRegion] = useState<Region | null>(null);
  // The same, but only where the user took the map: decides "Search this area"
  const [userRegion, setUserRegion] = useState<Region | null>(null);
  const [query, setQuery] = useState('');

  if (trip === undefined) {
    return <ActivityIndicator className="flex-1 bg-background" />;
  }

  const { exploring } = explore;
  const isRoute = route.tripDay !== undefined;

  function selectPin(key: string) {
    select(key);
    const pin = pins.find((candidate) => candidate.key === key);
    if (pin) void revealPin.reveal(pin.coordinates);
  }

  return (
    <View className="flex-1 bg-background" onLayout={revealPin.onLayout}>
      <MapView
        ref={mapRef}
        // A new trip mounts a new map, so it opens on that trip's city
        key={trip?._id ?? 'no-trip'}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onRegionChangeComplete={(next, details) => {
          setRegion(next);
          if (!revealPin.takeRevealMove(details.isGesture)) setUserRegion(next);
        }}
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
        {isRoute ? (
          <DayRouteLayer key={route.layerKey} stops={route.stops} onPressStop={route.openStop} />
        ) : (
          <PinLayer
            pins={pins}
            region={region ?? initialRegion}
            selectedKey={selectedKey}
            onSelect={selectPin}
            kind={mode.kind}
          />
        )}
      </MapView>

      {/* box-none: the overlay's empty space lets touches through to the map */}
      <SafeAreaView edges={['top']} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View pointerEvents="box-none" className="gap-2 p-3" onLayout={revealPin.onTopLayout}>
          {route.tripDay ? (
            <DayRouteCard
              tripDay={route.tripDay}
              stops={route.stops}
              onClose={route.close}
              onPlanDay={route.planDay}
            />
          ) : (
            <PlacesOverlay
              places={places}
              query={query}
              onQueryChange={setQuery}
              userRegion={userRegion}
            />
          )}
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
      {trip && !selected && !isRoute ? <MapLegend mode={mode} /> : null}
      {/* Hidden while typing in the search bar, so it doesn't sit on top of the keyboard */}
      {selected && query === '' && !isRoute ? (
        <PlacePreviewCard
          pin={selected}
          mode={mode}
          exploringCity={exploring?.destination.name}
          onAdd={() => places.addPin(selected)}
          onRemove={() => places.removePin(selected)}
          onPlanTrip={explore.planTrip}
          onClose={() => select(null)}
        />
      ) : null}
    </View>
  );
}

type MapPlaces = ReturnType<typeof useMapPlaces>;

// The top of the map while it shows places: the search bar, then (unless typing) the side
// switch, the explored city with "Plan trip", what the map shows with "Search this area" or
// "Search wider", and the filter chips
function PlacesOverlay({
  places,
  query,
  onQueryChange,
  userRegion,
}: {
  places: MapPlaces;
  query: string;
  onQueryChange: (query: string) => void;
  userRegion: Region | null;
}) {
  const { mode, setKind, filter, setFilterId } = usePlaceMode();
  const { explore, select, shown, shownArea, widerArea } = places;
  const count = shown.data?.length ?? 0;
  const isSparse = !shown.isFetching && shown.error === null && count < FEW_PLACES;

  return (
    <>
      <MapSearchBar
        value={query}
        isBusy={explore.isLocating}
        onChangeText={onQueryChange}
        onSelect={(destination) => {
          onQueryChange('');
          select(null);
          void explore.start(destination);
        }}
      />
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
          {explore.exploring ? (
            <ExploreCard
              name={explore.exploring.destination.name}
              region={explore.exploring.destination.region}
              photoName={explore.exploring.photoName}
              onPlanTrip={explore.planTrip}
              onClose={explore.stop}
            />
          ) : null}
          {shownArea ? (
            <MapStatus
              title={places.title}
              searchedArea={shownArea}
              region={userRegion}
              countLabel={mode.count(count)}
              isLoading={shown.isFetching}
              error={shown.error}
              onRetry={() => void shown.refetch()}
              onSearchArea={places.searchShownArea}
              wider={
                isSparse && widerArea
                  ? {
                      label: `Search ${Math.round(widerArea.radiusMeters / 1000)} km around`,
                      onPress: places.searchWider,
                    }
                  : undefined
              }
            />
          ) : null}
          <FilterChips
            mode={mode}
            categories={places.categories}
            selected={filter}
            onSelect={setFilterId}
            contentClassName="px-0.5 py-1"
          />
        </>
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
