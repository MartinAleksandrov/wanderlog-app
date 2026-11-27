import { ConvexError, v, type Infer } from 'convex/values';
import { action, type ActionCtx } from './_generated/server';
import { coordinates, placeKind, type Coordinates, type PlaceKind } from './schema';

// Google Places API (New), called from our backend so the API key never ships inside the app.
// Set the key once per deployment: npx convex env set GOOGLE_MAPS_API_KEY <key>
// Google bills each request by the fields it asks for (the field mask), so every request
// below asks only for what the app shows.

export const PLACES_API = 'https://places.googleapis.com/v1';

// Google normally answers in well under a second. Without a limit, a stalled request would keep
// the action (and the spinner in the app) waiting for minutes.
const GOOGLE_TIMEOUT_MS = 10_000;

// fetch() that gives up after GOOGLE_TIMEOUT_MS; the returned promise then rejects
export async function fetchGoogle(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// A destination the user can pick for a trip (a city)
export type DestinationSuggestion = { placeId: string; name: string; region: string };

// A place to visit near the trip's destination: a map pin and a card in the places list
export type SuggestedPlace = {
  providerPlaceId: string;
  name: string;
  coordinates: Coordinates;
  address?: string;
  // The main photo (the places list's cards, and the map's pop-up and the details sheet until
  // their own photos load), and a few more for the map's pop-up and the details sheet
  photoName?: string;
  photoNames: string[];
  category?: string;
  rating?: number;
  ratingCount?: number;
  summary?: string;
  // Missing when Google doesn't know its hours (often parks, squares and landmarks)
  hours?: PlaceHours;
};

// Whether a place was open when Google was asked, and when that changes next. The app works out
// "Open · closes 18:00" from it at the moment it shows it (src/features/places/open-status.ts),
// so an answer cached an hour ago is still right.
export type PlaceHours = {
  openNow: boolean;
  // While open: when it closes. While closed: when it opens. Up to a week ahead, as an
  // RFC 3339 time in UTC ("2026-11-23T18:00:00Z"). Missing when it doesn't (open 24 hours,
  // or closed for good).
  nextCloseTime?: string;
  nextOpenTime?: string;
  // The place's time zone, in minutes from UTC: "closes 18:00" is on the place's clock, even
  // when the phone is still on home time
  utcOffsetMinutes?: number;
};

// A few photos per place: each one shown is a paid request
const MAX_PHOTOS = 5;

// A Google review, as the place pop-up shows it (the author's name must be shown with it)
export type PlaceReview = { author: string; rating?: number; text: string; when?: string };

// Everything the place details sheet shows: the suggestion's fields plus opening hours, contact
// details and reviews
export type PlaceDetails = SuggestedPlace & {
  googleMapsUrl?: string;
  website?: string;
  phone?: string;
  // This week's hours ("Monday: 9:00 AM – 6:00 PM", …); whether it's open now is in `hours`
  openingHours?: string[];
  reviews: PlaceReview[];
  // Which side of the app the place belongs on, from its primary type (see kindOfType)
  kind: PlaceKind;
};

// What each side of the app searches Google for. Names from Google's "Table A" place types
// (an unknown name makes Google reject the whole search).
const PLACE_TYPES: Record<PlaceKind, string[]> = {
  // What a traveller would visit: culture, landmarks, viewpoints and parks
  sight: [
    'tourist_attraction',
    'museum',
    'art_gallery',
    'historical_landmark',
    'monument',
    'castle',
    'church',
    'observation_deck',
    'park',
    'botanical_garden',
  ],
  // Sweet spots: bakeries, cafes, brunch and desserts
  sweet: [
    'bakery',
    'pastry_shop',
    'cake_shop',
    'cafe',
    'coffee_shop',
    'tea_house',
    'breakfast_restaurant',
    'brunch_restaurant',
    'dessert_shop',
    'dessert_restaurant',
    'ice_cream_shop',
    'donut_shop',
    'chocolate_shop',
    'confectionery',
  ],
  // Restaurants: a meal of any cuisine. Fast food (fast_food_restaurant, where Google files the
  // big chains) is left out, but burger restaurants stay: the rating rule keeps the good ones.
  // Breakfast and brunch places are sweet spots.
  restaurant: [
    'restaurant',
    'american_restaurant',
    'asian_restaurant',
    'barbecue_restaurant',
    'brazilian_restaurant',
    'chinese_restaurant',
    'fine_dining_restaurant',
    'french_restaurant',
    'greek_restaurant',
    'hamburger_restaurant',
    'indian_restaurant',
    'indonesian_restaurant',
    'italian_restaurant',
    'japanese_restaurant',
    'korean_restaurant',
    'lebanese_restaurant',
    'mediterranean_restaurant',
    'mexican_restaurant',
    'middle_eastern_restaurant',
    'pizza_restaurant',
    'ramen_restaurant',
    'seafood_restaurant',
    'spanish_restaurant',
    'steak_house',
    'sushi_restaurant',
    'thai_restaurant',
    'turkish_restaurant',
    'vegan_restaurant',
    'vegetarian_restaurant',
    'vietnamese_restaurant',
  ],
};

// Sweet spots and restaurants must be loved by many: a lone 5-star review says little, and
// there are plenty of cafes and restaurants to choose from. Sights have no rule: a famous
// landmark is worth seeing whatever its rating.
//   sweet spots: rated above 4.0 by more than 50 people
//   restaurants: rated 4.1 or more by at least 50 people
const RATING_RULES: Partial<Record<PlaceKind, (rating: number, count: number) => boolean>> = {
  sweet: (rating, count) => rating > 4.0 && count > 50,
  restaurant: (rating, count) => rating >= 4.1 && count >= 50,
};

function isWellRated(place: SuggestedPlace, kind: PlaceKind): boolean {
  const rule = RATING_RULES[kind];
  return rule === undefined || rule(place.rating ?? 0, place.ratingCount ?? 0);
}

// Food places the nearby searches don't look for, but someone can search for by name or words.
// Only compared here, never sent to Google, so a name Google doesn't use costs nothing.
const MORE_SWEET_TYPES = [
  'acai_shop',
  'bagel_shop',
  'candy_store',
  'juice_shop',
  'cat_cafe',
  'dog_cafe',
  'chocolate_factory',
];
const MORE_RESTAURANT_TYPES = [
  'diner',
  'bistro',
  'gastropub',
  'bar_and_grill',
  'sandwich_shop',
  'deli',
  'cafeteria',
  'food_court',
  'meal_takeaway',
  'meal_delivery',
];

// Which side of the app a place found with the map's search bar belongs on, from its primary
// type: cafés and bakeries are sweet spots, any place for a meal a restaurant, anything else
// (museums, parks, shops, bars) a place to visit. Sweet spots are checked first: Google files
// brunch and dessert places as restaurants too. Restaurants include the ones the nearby search
// leaves out (fast food, diners, takeaways): someone who searched for one wants it.
function kindOfType(type: string | undefined): PlaceKind {
  if (type === undefined) return 'sight';
  if (PLACE_TYPES.sweet.includes(type) || MORE_SWEET_TYPES.includes(type)) return 'sweet';
  if (
    PLACE_TYPES.restaurant.includes(type) ||
    MORE_RESTAURANT_TYPES.includes(type) ||
    type.endsWith('_restaurant')
  ) {
    return 'restaurant';
  }
  return 'sight';
}

// Google bills a request at the price tier of its most expensive field. rating, userRatingCount
// and currentOpeningHours are "Nearby Search Enterprise", utcOffsetMinutes "Pro", and
// editorialSummary (the short description) "Enterprise + Atmosphere", the highest: so the whole
// request is Enterprise + Atmosphere (1,000 free calls a month), and the opening hours cost
// nothing extra.
const NEARBY_FIELDS = [
  'places.id',
  'places.displayName',
  'places.shortFormattedAddress',
  'places.location',
  'places.photos',
  'places.primaryTypeDisplayName',
  'places.rating',
  'places.userRatingCount',
  'places.editorialSummary',
  'places.currentOpeningHours',
  'places.utcOffsetMinutes',
].join(',');

// The parts of Google's place object that the field masks above ask for
type GooglePlace = {
  id: string;
  displayName?: { text: string };
  shortFormattedAddress?: string;
  location?: Coordinates;
  photos?: { name: string }[];
  // Google's name for the type ("coffee_shop"), and how it's shown ("Coffee shop")
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
  editorialSummary?: { text: string };
  currentOpeningHours?: {
    openNow?: boolean;
    nextOpenTime?: string;
    nextCloseTime?: string;
    weekdayDescriptions?: string[];
  };
  utcOffsetMinutes?: number;
};

// Only what the app needs from Google's opening hours (the full answer also lists every opening
// period of the week)
function hoursOf(place: GooglePlace): PlaceHours | undefined {
  const hours = place.currentOpeningHours;
  if (hours?.openNow === undefined) return undefined;
  return {
    openNow: hours.openNow,
    nextOpenTime: hours.nextOpenTime,
    nextCloseTime: hours.nextCloseTime,
    utcOffsetMinutes: place.utcOffsetMinutes,
  };
}

// The place pop-up's fields. Hours, website and phone are the "Place Details Enterprise" tier,
// editorialSummary and reviews "Enterprise + Atmosphere": 1,000 free calls a month. The app
// caches the answer per place, so opening the same place again doesn't call Google.
// primaryType (which side a searched place goes on) is a cheaper tier, so it costs nothing extra.
const DETAILS_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'photos',
  'primaryType',
  'primaryTypeDisplayName',
  'googleMapsUri',
  'rating',
  'userRatingCount',
  'currentOpeningHours',
  'utcOffsetMinutes',
  'websiteUri',
  'internationalPhoneNumber',
  'editorialSummary',
  'reviews',
].join(',');

// The extra parts of Google's place object that DETAILS_FIELDS asks for
type GooglePlaceDetails = GooglePlace & {
  formattedAddress?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  reviews?: {
    rating?: number;
    text?: { text: string };
    relativePublishTimeDescription?: string;
    authorAttribution?: { displayName?: string };
  }[];
};

type GoogleAutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      structuredFormat: { mainText: { text: string }; secondaryText?: { text: string } };
      // All of the place's types ("locality", "coffee_shop", "establishment"…), in no set order
      types?: string[];
    };
  }[];
};

// Destinations (cities) matching what the user has typed so far
export const searchDestinations = action({
  args: { query: v.string() },
  handler: async (ctx, { query }): Promise<DestinationSuggestion[]> => {
    const data = await placesRequest<GoogleAutocompleteResponse>(ctx, 'places:autocomplete', {
      body: { input: query, includedPrimaryTypes: ['(cities)'] },
    });
    return (data.suggestions ?? []).flatMap(({ placePrediction: p }) =>
      p
        ? [
            {
              placeId: p.placeId,
              name: p.structuredFormat.mainText.text,
              region: p.structuredFormat.secondaryText?.text ?? '',
            },
          ]
        : [],
    );
  },
});

// Where a picked destination is, and a photo of it. Autocomplete returns only names, so this
// is the one extra call made when a trip is created.
export const destinationDetails = action({
  args: { placeId: v.string() },
  handler: async (ctx, { placeId }) => {
    const place = await placesRequest<GooglePlace>(ctx, `places/${encodeURIComponent(placeId)}`, {
      method: 'GET',
      fieldMask: 'location,photos',
    });
    if (place.location === undefined) {
      throw new ConvexError("Google doesn't know where this place is. Try another one.");
    }
    return { coordinates: place.location, photoName: place.photos?.[0]?.name };
  },
});

// A place to stay the user can pick for a booking: a hotel, or any address (a rented apartment)
export type StaySuggestion = { placeId: string; name: string; address: string };

// Nearby results first: Google's search radius limit, 50 km, covers a city and its airport
const STAY_SEARCH_RADIUS_METERS = 50_000;

// Hotels and addresses matching what the user has typed so far, the ones near the trip's
// destination first. No place type filter: Google calls hotels "hotel", "hostel", "lodging" and
// more, and a rented apartment is just an address.
export const searchStays = action({
  args: { query: v.string(), near: v.optional(coordinates) },
  handler: async (ctx, { query, near }): Promise<StaySuggestion[]> => {
    const data = await placesRequest<GoogleAutocompleteResponse>(ctx, 'places:autocomplete', {
      body: {
        input: query,
        ...(near
          ? { locationBias: { circle: { center: near, radius: STAY_SEARCH_RADIUS_METERS } } }
          : {}),
      },
    });
    return (data.suggestions ?? []).flatMap(({ placePrediction: p }) =>
      p
        ? [
            {
              placeId: p.placeId,
              name: p.structuredFormat.mainText.text,
              address: p.structuredFormat.secondaryText?.text ?? '',
            },
          ]
        : [],
    );
  },
});

// A picked stay's full address, map position and contact details, saved with the booking.
// Phone and website are the "Place Details Enterprise" tier (1,000 free calls a month); this runs
// once per stay added, when the user picks it.
export const stayDetails = action({
  args: { placeId: v.string() },
  handler: async (ctx, { placeId }) => {
    const place = await placesRequest<GooglePlaceDetails>(
      ctx,
      `places/${encodeURIComponent(placeId)}`,
      {
        method: 'GET',
        fieldMask: 'location,formattedAddress,internationalPhoneNumber,websiteUri',
      },
    );
    return {
      coordinates: place.location,
      address: place.formattedAddress,
      phone: place.internationalPhoneNumber,
      website: place.websiteUri,
    };
  },
});

// Where to look for places: the rectangle the map shows (its centre, width and height)
export const searchArea = v.object({
  center: coordinates,
  widthMeters: v.number(),
  heightMeters: v.number(),
});
export type SearchArea = Infer<typeof searchArea>;

// Google's Nearby Search returns at most 20 places and has no "next page"
const PLACES_PER_SEARCH = 20;
// The most places one search shows: enough to fill the map, few enough to keep it readable
const MAX_PLACES = 30;
// Nearby Search takes circles of up to 50 km
const MAX_RADIUS_METERS = 50_000;

// The most popular places of one kind on the map's rectangle, at most 30, most reviewed first.
//
// One search (20 places, in a circle) leaves the map half empty: much of the circle is off the
// screen, and the rating rules (sweet spots, restaurants) drop more. So the rectangle is split
// into four quarters, each searched on its own (four calls at once), and only places inside the
// rectangle are kept. Taking each quarter's best in turn spreads the pins over the whole map
// instead of only the busy centre.
//
// Sights match any of a place's types (a park that's also a tourist attraction counts). Sweet
// spots and restaurants must be one of those types first and foremost (its primary type):
// supermarkets and petrol stations also carry "bakery" or "cafe" among their types, and hotels
// "restaurant".
export const nearbyPlaces = action({
  args: { area: searchArea, kind: placeKind },
  handler: async (ctx, { area: requested, kind }): Promise<SuggestedPlace[]> => {
    const area = searchableArea(requested);
    const types =
      kind === 'sight'
        ? { includedTypes: PLACE_TYPES.sight }
        : { includedPrimaryTypes: PLACE_TYPES[kind] };
    const answers = await Promise.allSettled(
      quarterCircles(area).map((circle) =>
        placesRequest<{ places?: GooglePlace[] }>(ctx, 'places:searchNearby', {
          fieldMask: NEARBY_FIELDS,
          body: {
            ...types,
            maxResultCount: PLACES_PER_SEARCH,
            rankPreference: 'POPULARITY',
            locationRestriction: { circle },
          },
        }),
      ),
    );
    // One quarter failing (a timeout) still leaves the other quarters' places to show. Only when
    // all four fail does the app get the error.
    const found = answers.flatMap((answer) =>
      answer.status === 'fulfilled' ? [answer.value] : [],
    );
    const failed = answers.find((answer) => answer.status === 'rejected');
    if (found.length === 0 && failed) throw failed.reason;

    const perQuarter = found.map((data) =>
      (data.places ?? [])
        .flatMap(toSuggestedPlace)
        .filter((place) => isInside(area, place.coordinates))
        .filter((place) => isWellRated(place, kind)),
    );
    // A popular place near the middle is found by several quarters: keep it once, in its first
    // spot (a Map keeps the order things were added in)
    const unique = new Map<string, SuggestedPlace>();
    for (const place of takeInTurn(perQuarter)) {
      if (!unique.has(place.providerPlaceId)) unique.set(place.providerPlaceId, place);
    }
    // The quarters chose which places to keep; the places list shows them most reviewed first
    return [...unique.values()]
      .slice(0, MAX_PLACES)
      .sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0));
  },
});

// One of Google's places as a suggestion, or nothing when Google left out where it is
function toSuggestedPlace(place: GooglePlace): SuggestedPlace[] {
  if (!place.location || !place.displayName) return [];
  return [
    {
      providerPlaceId: place.id,
      name: place.displayName.text,
      coordinates: place.location,
      address: place.shortFormattedAddress,
      photoName: place.photos?.[0]?.name,
      // Already in the answer (places.photos), so the pop-up's photos cost no extra call
      photoNames: (place.photos ?? []).slice(0, MAX_PHOTOS).map((photo) => photo.name),
      category: place.primaryTypeDisplayName?.text,
      rating: place.rating,
      ratingCount: place.userRatingCount,
      summary: place.editorialSummary?.text,
      hours: hoursOf(place),
    },
  ];
}

// The first of every list, then the second of every list, and so on
function takeInTurn<T>(lists: T[][]): T[] {
  const longest = Math.max(0, ...lists.map((list) => list.length));
  return Array.from({ length: longest }, (_, i) =>
    lists.flatMap((list) => list.slice(i, i + 1)),
  ).flat();
}

// Metres to degrees and back. A degree of latitude is about 111 km; a degree of longitude gets
// narrower away from the equator. Plenty precise at city size.
const METERS_PER_DEGREE = 111_000;
function metersPerLongitudeDegree(latitude: number): number {
  return METERS_PER_DEGREE * Math.cos((latitude * Math.PI) / 180);
}

// The radius of the smallest circle around one quarter of the rectangle
function quarterRadius({ widthMeters, heightMeters }: SearchArea): number {
  return Math.hypot(widthMeters / 4, heightMeters / 4);
}

// The map zoomed out to a whole country is too big for four 50 km circles: search the middle of
// it instead, the biggest rectangle of the same shape that they cover
function searchableArea(area: SearchArea): SearchArea {
  const scale = MAX_RADIUS_METERS / quarterRadius(area);
  if (scale >= 1) return area;
  return {
    center: area.center,
    widthMeters: area.widthMeters * scale,
    heightMeters: area.heightMeters * scale,
  };
}

// Longitudes run from -180 to 180: 190 degrees east is -170
function wrapLongitude(degrees: number): number {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

// The four quarters of the rectangle, each as the smallest circle around it (Nearby Search only
// takes circles)
function quarterCircles(area: SearchArea) {
  const { center, widthMeters, heightMeters } = area;
  const east = widthMeters / 4;
  const north = heightMeters / 4;
  const radius = Math.max(quarterRadius(area), 100);
  // West or east (x), south or north (y) of the centre
  const quarters = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ] as const;
  return quarters.map(([x, y]) => ({
    center: {
      latitude: Math.min(Math.max(center.latitude + (y * north) / METERS_PER_DEGREE, -90), 90),
      longitude: wrapLongitude(
        center.longitude + (x * east) / metersPerLongitudeDegree(center.latitude),
      ),
    },
    radius,
  }));
}

// Whether a point is on the rectangle (the quarters' circles reach past its edges)
function isInside({ center, widthMeters, heightMeters }: SearchArea, point: Coordinates): boolean {
  const north = (point.latitude - center.latitude) * METERS_PER_DEGREE;
  const east =
    wrapLongitude(point.longitude - center.longitude) * metersPerLongitudeDegree(center.latitude);
  return Math.abs(north) <= heightMeters / 2 && Math.abs(east) <= widthMeters / 2;
}

// The rectangle as Google takes it: its south-west and north-east corners. A map zoomed out to
// the whole world is capped just short of 360 degrees wide, so the corners stay apart.
function toRectangle({ center, widthMeters, heightMeters }: SearchArea) {
  const north = heightMeters / 2 / METERS_PER_DEGREE;
  const east = Math.min(widthMeters / 2 / metersPerLongitudeDegree(center.latitude), 179);
  return {
    low: {
      latitude: Math.max(center.latitude - north, -90),
      longitude: wrapLongitude(center.longitude - east),
    },
    high: {
      latitude: Math.min(center.latitude + north, 90),
      longitude: wrapLongitude(center.longitude + east),
    },
  };
}

// A single place the map's search bar suggests: a café, a museum, a hotel, an address
export type PlaceSuggestion = {
  placeId: string;
  name: string;
  address: string;
  // Google's types as words ("coffee shop cafe food store establishment"), only to pick the
  // row's icon. Missing for addresses and streets, which get a plain pin.
  typeWords?: string;
};

// What the map's search bar suggests for what's typed so far: a city (the map explores it) or a
// single place (the map flies to it and opens its pop-up)
export type MapSearchSuggestion =
  ({ type: 'city' } & DestinationSuggestion) | ({ type: 'place' } & PlaceSuggestion);

// Google's types for a city, as its "(cities)" filter has them
const CITY_TYPES = ['locality', 'administrative_area_level_3', 'postal_town'];
// Countries and regions: too big to explore as a city or to show as one pin. Left out, as the
// cities-only search always did.
const REGION_TYPES = [
  'country',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'colloquial_area',
];

// Cities and places matching what the user has typed so far, the ones near where the map looks
// first. One autocomplete request with no type filter: Google's "(cities)" filter can't be
// combined with other types, and two requests would cost twice as much.
export const searchMap = action({
  args: { query: v.string(), near: v.optional(searchArea) },
  handler: async (ctx, { query, near }): Promise<MapSearchSuggestion[]> => {
    const data = await placesRequest<GoogleAutocompleteResponse>(ctx, 'places:autocomplete', {
      body: { input: query, ...(near ? { locationBias: { rectangle: toRectangle(near) } } : {}) },
    });
    return (data.suggestions ?? []).flatMap(({ placePrediction }) =>
      placePrediction ? toMapSuggestion(placePrediction) : [],
    );
  },
});

type GooglePrediction = NonNullable<
  NonNullable<GoogleAutocompleteResponse['suggestions']>[number]['placePrediction']
>;

// One of Google's predictions as a city or a place, or nothing for a country or region
function toMapSuggestion(prediction: GooglePrediction): MapSearchSuggestion[] {
  const types = prediction.types ?? [];
  const placeId = prediction.placeId;
  const name = prediction.structuredFormat.mainText.text;
  const secondary = prediction.structuredFormat.secondaryText?.text ?? '';
  if (types.some((type) => CITY_TYPES.includes(type))) {
    return [{ type: 'city', placeId, name, region: secondary }];
  }
  if (types.some((type) => REGION_TYPES.includes(type))) return [];
  return [
    {
      type: 'place',
      placeId,
      name,
      address: secondary,
      typeWords: types.includes('establishment') ? types.join(' ').replaceAll('_', ' ') : undefined,
    },
  ];
}

// The nearby search's fields, plus each place's type to tell which side most of them belong on
const TEXT_SEARCH_FIELDS = `${NEARBY_FIELDS},places.primaryType`;

// What a text search found, and the side most of the places belong on ("coffee" → sweet spots),
// null when nothing was found
export type TextSearchResult = { kind: PlaceKind | null; places: SuggestedPlace[] };

// Every place matching words such as "coffee" or "sushi" on the map's rectangle: one page of
// Google's Text Search (at most 20), best matches first. The same price tier as the nearby search
// (the same fields), but one request instead of four. No rating rules: the user asked for these.
export const searchText = action({
  args: { query: v.string(), area: searchArea },
  handler: async (ctx, { query, area }): Promise<TextSearchResult> => {
    const data = await placesRequest<{ places?: GooglePlace[] }>(ctx, 'places:searchText', {
      fieldMask: TEXT_SEARCH_FIELDS,
      body: {
        textQuery: query,
        pageSize: PLACES_PER_SEARCH,
        locationRestriction: { rectangle: toRectangle(area) },
      },
    });
    const found = (data.places ?? []).filter((place) => place.location && place.displayName);
    return { kind: mostCommonKind(found), places: found.flatMap(toSuggestedPlace) };
  },
});

// The side most of the places belong on; on a tie, the best match's (a Map keeps the order its
// keys were added in, and only a higher count takes over)
function mostCommonKind(places: GooglePlace[]): PlaceKind | null {
  const counts = new Map<PlaceKind, number>();
  for (const place of places) {
    const kind = kindOfType(place.primaryType);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  let best: PlaceKind | null = null;
  let bestCount = 0;
  for (const [kind, count] of counts) {
    if (count > bestCount) {
      best = kind;
      bestCount = count;
    }
  }
  return best;
}

// More about one place, for the pop-up that opens when a place is tapped
export const placeDetails = action({
  args: { placeId: v.string() },
  handler: async (ctx, { placeId }): Promise<PlaceDetails> => {
    const place = await placesRequest<GooglePlaceDetails>(
      ctx,
      `places/${encodeURIComponent(placeId)}`,
      { method: 'GET', fieldMask: DETAILS_FIELDS },
    );
    if (place.location === undefined || place.displayName === undefined) {
      throw new ConvexError('Google has no details for this place. Try another one.');
    }
    return {
      providerPlaceId: place.id,
      name: place.displayName.text,
      coordinates: place.location,
      address: place.formattedAddress,
      photoName: place.photos?.[0]?.name,
      category: place.primaryTypeDisplayName?.text,
      rating: place.rating,
      ratingCount: place.userRatingCount,
      summary: place.editorialSummary?.text,
      photoNames: (place.photos ?? []).slice(0, MAX_PHOTOS).map((photo) => photo.name),
      googleMapsUrl: place.googleMapsUri,
      website: place.websiteUri,
      phone: place.internationalPhoneNumber,
      hours: hoursOf(place),
      kind: kindOfType(place.primaryType),
      openingHours: place.currentOpeningHours?.weekdayDescriptions,
      reviews: (place.reviews ?? []).slice(0, 3).flatMap((review) =>
        review.text?.text
          ? [
              {
                author: review.authorAttribution?.displayName ?? 'A Google user',
                rating: review.rating,
                text: review.text.text,
                when: review.relativePublishTimeDescription,
              },
            ]
          : [],
      ),
    };
  },
});

// One call to the Places API. Only signed-in users may call it, because every call costs money.
async function placesRequest<T>(
  ctx: ActionCtx,
  path: string,
  {
    method = 'POST',
    fieldMask,
    body,
  }: { method?: 'GET' | 'POST'; fieldMask?: string; body?: object },
): Promise<T> {
  if ((await ctx.auth.getUserIdentity()) === null) {
    throw new ConvexError('Please sign in again.');
  }
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new ConvexError(
      'Place search is not set up yet: GOOGLE_MAPS_API_KEY is missing on the Convex deployment.',
    );
  }

  let response: Response;
  try {
    response = await fetchGoogle(`${PLACES_API}/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        ...(fieldMask ? { 'X-Goog-FieldMask': fieldMask } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    // Timed out (see fetchGoogle) or no connection at all
    console.error(`Google Places ${path} did not answer:`, error);
    throw new ConvexError('Google Places is taking too long to answer. Please try again.');
  }
  if (!response.ok) {
    // The details go to the Convex dashboard's logs; the app gets a short message
    console.error(`Google Places ${path} failed (${response.status}):`, await response.text());
    throw new ConvexError("Couldn't reach Google Places. Please try again.");
  }
  return (await response.json()) as T;
}
