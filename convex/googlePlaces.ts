import { ConvexError, v } from 'convex/values';
import { action, type ActionCtx } from './_generated/server';
import { coordinates, type Coordinates } from './schema';

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
  // Whether it's open right now, and this week's hours ("Monday: 9:00 AM – 6:00 PM", …)
  openNow?: boolean;
  openingHours?: string[];
  reviews: PlaceReview[];
};

// What a traveller would visit: culture, landmarks, viewpoints and parks. Names from Google's
// "Table A" place types.
const ATTRACTION_TYPES = [
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
];

// rating and userRatingCount make this the "Nearby Search Enterprise" price tier, and
// editorialSummary (the short description) "Enterprise + Atmosphere": 1,000 free calls a month
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
};

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
  currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
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

// The most popular places to visit within `radiusMeters` of `center`, at most 20
export const nearbyAttractions = action({
  args: { center: coordinates, radiusMeters: v.number() },
  handler: async (ctx, { center, radiusMeters }): Promise<SuggestedPlace[]> => {
    const data = await placesRequest<{ places?: GooglePlace[] }>(ctx, 'places:searchNearby', {
      fieldMask: NEARBY_FIELDS,
      body: {
        includedTypes: ATTRACTION_TYPES,
        maxResultCount: 20,
        rankPreference: 'POPULARITY',
        locationRestriction: {
          // Google accepts a radius up to 50 km
          circle: { center, radius: Math.min(Math.max(radiusMeters, 500), 50_000) },
        },
      },
    });
    return (data.places ?? []).flatMap((place) =>
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
            },
          ]
        : [],
    );
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
      openNow: place.currentOpeningHours?.openNow,
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
