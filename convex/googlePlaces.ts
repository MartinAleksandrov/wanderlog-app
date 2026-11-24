import { ConvexError, v } from 'convex/values';
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
  // The main photo (pins and cards), and a few more for the map's pop-up and the details sheet
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
};

// Sweet spots must be loved by many: rated above 4.0 by more than 50 people. A lone 5-star
// review says little, and there are plenty of cafes to choose from.
const SWEET_MIN_RATING = 4.0;
const SWEET_MIN_REVIEWS = 50;

function isWellRated(place: SuggestedPlace): boolean {
  return (place.rating ?? 0) > SWEET_MIN_RATING && (place.ratingCount ?? 0) > SWEET_MIN_REVIEWS;
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
const DETAILS_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'photos',
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

// The most popular places of one kind within `radiusMeters` of `center`, at most 20. Sweet
// spots are then narrowed to the well-rated ones, so there can be fewer.
//
// Sights match any of a place's types (a park that's also a tourist attraction counts). Sweet
// spots must be one of those types first and foremost (its primary type): supermarkets and
// petrol stations also carry "bakery" or "cafe" among their types.
export const nearbyPlaces = action({
  args: { center: coordinates, radiusMeters: v.number(), kind: placeKind },
  handler: async (ctx, { center, radiusMeters, kind }): Promise<SuggestedPlace[]> => {
    const types =
      kind === 'sweet'
        ? { includedPrimaryTypes: PLACE_TYPES.sweet }
        : { includedTypes: PLACE_TYPES.sight };
    const data = await placesRequest<{ places?: GooglePlace[] }>(ctx, 'places:searchNearby', {
      fieldMask: NEARBY_FIELDS,
      body: {
        ...types,
        maxResultCount: 20,
        rankPreference: 'POPULARITY',
        locationRestriction: {
          // Google accepts a radius up to 50 km
          circle: { center, radius: Math.min(Math.max(radiusMeters, 500), 50_000) },
        },
      },
    });
    const places = (data.places ?? []).flatMap((place) =>
      place.location && place.displayName
        ? [
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
          ]
        : [],
    );
    return kind === 'sweet' ? places.filter(isWellRated) : places;
  },
});

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
