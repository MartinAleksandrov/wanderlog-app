import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useMyLocation } from '@/lib/my-location';
import { PlaneTakeoffIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DayRouteCard } from './components/day-route-card';
import { DayRouteLayer } from './components/day-route-layer';
import { ExploreCard } from './components/explore-card';
import { FilterButton } from './components/filter-button';
import { FilterPanel } from './components/filter-panel';
import { LocateButton } from './components/locate-button';
import { MapSearchBar } from './components/map-search-bar';
import { MapStatus } from './components/map-status';
import { ModeSwitch } from './components/mode-switch';
import { PinLayer } from './components/pin-layer';
import { PlacePreviewCard } from './components/place-preview-card';
import { isFiltered } from './place-filters';
import { usePlaceMode } from './place-mode-context';
import type { PlaceMode } from './place-modes';
import { FEW_PLACES } from './map-area';
import { useDistanceTo } from './use-distance';
import { useLocateMe } from './use-locate-me';
import { useMapPlaces } from './use-map-places';
import { useMapRoute } from './use-map-route';
import { useRevealPin } from './use-reveal-pin';

// The second tab: a Google map with places as photo pins, for the side switched on under the
// search bar: sights (orange suggestions, purple trip places, Google's normal map), sweet spots
// (pink suggestions, chocolate saved spots, a cream map) or restaurants (red suggestions, teal
// saved restaurants, a grey map; see place-modes.ts). The filter button next to the switch
// narrows the pins to one kind (Coffee, Parks…) and/or the places open now, from a panel that
// drops down only when wanted, so the map keeps its room. Pins shrink to
// dots where they'd cover each other and grow back as you zoom in (pin-layout.ts). Tapping a pin
// opens its pop-up at the bottom, sliding the map up first if the pop-up would cover the pin;
// tapping the map closes it. The search bar finds any city: the map flies there, shows its
// places, and offers to plan a trip to it (use-explore-city.ts). The button at the bottom right
// flies to where you are (use-locate-me.ts).
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
  const location = useMyLocation();
  const locateMe = useLocateMe(mapRef);
  const distanceTo = useDistanceTo(places.shownArea);
  // What the map shows right now, updated when it stops moving (sizes the pins)
  const [region, setRegion] = useState<Region | null>(null);
  // The same, but only where the user took the map: decides "Search this area"
  const [userRegion, setUserRegion] = useState<Region | null>(null);
  const [query, setQuery] = useState('');
  // The filter panel under the switch; tapping the map or a pin closes it
  const [isFilterOpen, setFilterOpen] = useState(false);

  if (trip === undefined) {
    return <ActivityIndicator className="flex-1 bg-background" />;
  }

  const { exploring } = explore;
  const isRoute = route.tripDay !== undefined;
  // The tapped pin's pop-up. Hidden while typing in the search bar, so it doesn't sit on top of
  // the keyboard.
  const isPopUpOpen = selected !== undefined && query === '' && !isRoute;

  function selectPin(key: string) {
    setFilterOpen(false);
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
        // Google's blue "you are here" dot, once the location is allowed (places tab, "Turn on",
        // or the locate button). Google's own locate button would sit under the search bar, so
        // the map has its own at the bottom right, which needs to know where the dot is.
        showsUserLocation={location.access === 'granted'}
        showsMyLocationButton={false}
        onUserLocationChange={locateMe.onUserLocationChange}
        // Sweet spots get a warm cream map without Google's own shop icons
        customMapStyle={mode.mapStyle}
        // Tapping the map (not a pin) closes the pop-up and the filter panel. iOS reports pin
        // taps here too.
        onPress={(event) => {
          if (event.nativeEvent.action === 'marker-press') return;
          select(null);
          setFilterOpen(false);
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
              isFilterOpen={isFilterOpen}
              onFilterOpenChange={setFilterOpen}
            />
          )}
        </View>
      </SafeAreaView>

      {isPopUpOpen ? (
        <PlacePreviewCard
          pin={selected}
          mode={mode}
          distance={distanceTo?.(selected.coordinates)}
          exploringCity={exploring?.destination.name}
          onAdd={() => places.addPin(selected)}
          onRemove={() => places.removePin(selected)}
          onPlanTrip={explore.planTrip}
          onClose={() => select(null)}
        />
      ) : (
        <MapBottom
          mode={mode}
          locateMe={locateMe}
          showsHint={trip === null && !exploring}
          showsLegend={Boolean(trip) && !selected && !isRoute}
        />
      )}
    </View>
  );
}

type MapPlaces = ReturnType<typeof useMapPlaces>;

// The top of the map while it shows places: the search bar, then (unless typing) the side
// switch with the filter button (and its panel when open), the explored city with "Plan trip",
// and what the map shows with "Search this area" or "Search wider"
function PlacesOverlay({
  places,
  query,
  onQueryChange,
  userRegion,
  isFilterOpen,
  onFilterOpenChange,
}: {
  places: MapPlaces;
  query: string;
  onQueryChange: (query: string) => void;
  userRegion: Region | null;
  isFilterOpen: boolean;
  onFilterOpenChange: (isOpen: boolean) => void;
}) {
  const { mode } = usePlaceMode();
  const { explore, select, shown, shownArea, widerArea } = places;
  const count = shown.data?.length ?? 0;
  const isSparse = !shown.isFetching && shown.error === null && count < FEW_PLACES;
  // "7 of 18 sweet spots" while filtered, so it's clear some pins are hidden
  const countLabel = isFiltered(places.filters)
    ? `${places.pins.length} of ${mode.count(places.filterPlaces.length)}`
    : mode.count(count);

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
          <SideAndFilters
            places={places}
            isFilterOpen={isFilterOpen}
            onFilterOpenChange={onFilterOpenChange}
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
              countLabel={countLabel}
              isLoading={shown.isFetching}
              error={shown.error}
              onRetry={() => void shown.refetch()}
              onSearchArea={places.searchShownArea}
              wider={
                isSparse && widerArea
                  ? {
                      label: `Search ${Math.round(widerArea.widthMeters / 1000)} km wide`,
                      onPress: places.searchWider,
                    }
                  : undefined
              }
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}

// "[Sights | Sweet spots | Restaurants] (⚙)": the side switch with the filter button beside it,
// and the filter panel under them while it's open
function SideAndFilters({
  places,
  isFilterOpen,
  onFilterOpenChange,
}: {
  places: MapPlaces;
  isFilterOpen: boolean;
  onFilterOpenChange: (isOpen: boolean) => void;
}) {
  const { mode, setKind, setFilterId, setOpenNow } = usePlaceMode();
  const { filters, select } = places;
  const activeCount = (filters.filter ? 1 : 0) + (filters.openNow ? 1 : 0);

  return (
    <>
      <View pointerEvents="box-none" className="flex-row items-center justify-center gap-2">
        <ModeSwitch
          kind={mode.kind}
          onChange={(kind) => {
            // The open pop-up belongs to the previous side's pins
            select(null);
            setKind(kind);
          }}
        />
        <FilterButton
          mode={mode}
          activeCount={activeCount}
          isOpen={isFilterOpen}
          onPress={() => {
            // The panel and the pin pop-up don't share the screen
            select(null);
            onFilterOpenChange(!isFilterOpen);
          }}
        />
      </View>
      {isFilterOpen ? (
        <FilterPanel
          mode={mode}
          places={places.filterPlaces}
          filters={filters}
          onSelect={setFilterId}
          onOpenNowChange={setOpenNow}
          onClose={() => onFilterOpenChange(false)}
        />
      ) : null}
    </>
  );
}

// The map's bottom while no pin pop-up is open, stacked from the right: the locate button, over
// the legend or (without a trip) the hint to search a city. Google's logo sits bottom left.
function MapBottom({
  mode,
  locateMe,
  showsHint,
  showsLegend,
}: {
  mode: PlaceMode;
  locateMe: ReturnType<typeof useLocateMe>;
  showsHint: boolean;
  showsLegend: boolean;
}) {
  const location = useMyLocation();
  return (
    <View pointerEvents="box-none" className="absolute inset-x-3 bottom-3 items-end gap-3">
      <LocateButton
        isOn={location.access === 'granted'}
        isLocating={locateMe.isLocating}
        onPress={locateMe.locate}
      />
      {showsHint ? (
        <View className="flex-row items-center gap-3 self-stretch rounded-2xl border border-border bg-background p-4 shadow-lg">
          <Icon as={PlaneTakeoffIcon} className="size-6 text-orange-500" />
          <Text className="flex-1">
            Search a city above to see its {mode.label.toLowerCase()}, then plan your first trip
            there.
          </Text>
        </View>
      ) : null}
      {showsLegend ? <MapLegend mode={mode} /> : null}
    </View>
  );
}

// What the two pin colours mean, for the side that's switched on
function MapLegend({ mode }: { mode: PlaceMode }) {
  return (
    <View className="gap-1 rounded-lg bg-background/90 px-3 py-2">
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
