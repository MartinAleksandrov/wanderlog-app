import type { Coordinates } from '@convex/schema';
import { geoContains } from 'd3-geo';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import countriesTopology from 'world-atlas/countries-110m.json';

// The world map behind the account tab's globe, and which countries and cities the user's past
// trips were in.
//
// The shapes are Natural Earth's 1:110 million country outlines (the world-atlas package, about
// 100 KB): coarse, but a phone-sized globe can't show more, and fewer points keep each frame of
// the spinning globe cheap. They ship as TopoJSON, a compact format where neighbouring countries
// share their borders; topojson-client unpacks it into GeoJSON, which d3-geo draws.

export type Country = Feature<Polygon | MultiPolygon, { name: string }>;

type CountriesTopology = Topology<{ countries: GeometryCollection<{ name: string }> }>;

// Unpacked on first use (when the account tab first shows), not when the app starts
let countries: Country[] | undefined;

export function worldCountries(): Country[] {
  if (countries === undefined) {
    const topology = countriesTopology as unknown as CountriesTopology;
    const collection = feature(topology, topology.objects.countries) as FeatureCollection<
      Polygon | MultiPolygon,
      { name: string }
    >;
    countries = collection.features;
  }
  return countries;
}

// [longitude, latitude]: the order d3-geo and GeoJSON use (the map libraries use objects)
export function toLonLat(point: Coordinates): [number, number] {
  return [point.longitude, point.latitude];
}

// Google's spelling of a country (the end of "New York, NY, USA") -> the map's name for it
const MAP_NAMES: Record<string, string> = {
  usa: 'United States of America',
  'united states': 'United States of America',
  uk: 'United Kingdom',
  türkiye: 'Turkey',
  'czech republic': 'Czechia',
  'north macedonia': 'Macedonia',
  'bosnia and herzegovina': 'Bosnia and Herz.',
  'democratic republic of the congo': 'Dem. Rep. Congo',
  'dominican republic': 'Dominican Rep.',
  'central african republic': 'Central African Rep.',
  eswatini: 'eSwatini',
  'south sudan': 'S. Sudan',
  'equatorial guinea': 'Eq. Guinea',
  'solomon islands': 'Solomon Is.',
  'falkland islands': 'Falkland Is.',
};

// The map's short names, written out for the list of countries under the globe
const SHOWN_NAMES: Record<string, string> = {
  'United States of America': 'United States',
  Turkey: 'Türkiye',
  Macedonia: 'North Macedonia',
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'Dem. Rep. Congo': 'DR Congo',
  'Dominican Rep.': 'Dominican Republic',
  'Central African Rep.': 'Central African Republic',
  eSwatini: 'Eswatini',
  'S. Sudan': 'South Sudan',
  'Eq. Guinea': 'Equatorial Guinea',
  'Solomon Is.': 'Solomon Islands',
  'Falkland Is.': 'Falkland Islands',
};

// Countries too small for the map. Their cities sit inside a neighbour's coarse outline
// (Singapore in Malaysia's, San Marino in Italy's), so the point can't be trusted for them.
const NOT_ON_MAP = new Set([
  'andorra',
  'bahrain',
  'hong kong',
  'liechtenstein',
  'macao',
  'malta',
  'monaco',
  'san marino',
  'singapore',
  'vatican city',
]);

// The country of a trip's destination, to fill in on the globe. The country Google names at the
// end of it ("Geneva, Switzerland") comes first: the outlines are coarse, so a city near a
// border or on the coast can fall inside the neighbour's shape (Geneva in France's) or in the
// sea (Lisbon). Only a name the map doesn't know falls back to the shape the point is in.
// Countries too small for the map find nothing: they still count, by name (see visitedWorld).
export function countryAt(point: Coordinates, destination: string): Country | undefined {
  const named = countryPart(destination)?.toLowerCase();
  if (named === undefined || NOT_ON_MAP.has(named)) return undefined;

  const all = worldCountries();
  const mapName = (MAP_NAMES[named] ?? named).toLowerCase();
  const byName = all.find((country) => country.properties.name.toLowerCase() === mapName);
  return byName ?? all.find((country) => geoContains(country, toLonLat(point)));
}

// "Lisbon, Portugal" -> "Lisbon" and "Portugal". Google's destination names put the city first
// and the country last; a city-state is just its name ("Singapore"), the city and the country.
function firstPart(destination: string): string {
  return destination.split(',')[0]?.trim() || destination.trim();
}
function countryPart(destination: string): string | undefined {
  return destination.split(',').at(-1)?.trim() || undefined;
}

// A country's name in the list under the globe
function shownName(country: Country): string {
  const { name } = country.properties;
  return SHOWN_NAMES[name] ?? name;
}

export type VisitedCity = { name: string; coordinates: Coordinates };

export type VisitedWorld = {
  // Every country visited, by name, for the count. Includes small ones the globe can't draw
  // (Malta, Singapore), found from the destination's name.
  countryNames: Set<string>;
  // The countries to fill in on the globe
  countries: Set<Country>;
  // One dot per city, even when it was visited more than once. The newest trip's city first.
  cities: VisitedCity[];
};

type TripPlace = { destination: string; destinationCoordinates?: Coordinates };

// What the globe and the travel counts show, from the past trips (newest first)
export function visitedWorld(trips: TripPlace[]): VisitedWorld {
  const countryNames = new Set<string>();
  const visitedCountries = new Set<Country>();
  const cities = new Map<string, VisitedCity>();

  for (const trip of trips) {
    const point = trip.destinationCoordinates;
    const country = point ? countryAt(point, trip.destination) : undefined;
    const countryName = country ? shownName(country) : countryPart(trip.destination);
    if (country) visitedCountries.add(country);
    if (countryName) countryNames.add(countryName);

    const name = firstPart(trip.destination);
    const key = `${name}|${countryName ?? ''}`.toLowerCase();
    if (point && !cities.has(key)) cities.set(key, { name, coordinates: point });
  }

  return { countryNames, countries: visitedCountries, cities: [...cities.values()] };
}

// The city part of a trip's destination, for "How was Lisbon?"
export function cityName(destination: string): string {
  return firstPart(destination);
}
