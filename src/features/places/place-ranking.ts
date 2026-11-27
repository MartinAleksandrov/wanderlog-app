import type { SuggestedPlace } from '@convex/googlePlaces';

// How many suggestions the map and the places list show: enough to fill the map, few enough to
// keep it readable. The backend sends up to twice as many (see nearbyPlaces), so places already
// saved can make room for the next ones.
export const MAX_SUGGESTIONS = 30;

// From the backend's places (best pick first): every saved one, which the list and the map show
// with Google's fresh details, plus the first MAX_SUGGESTIONS that aren't saved yet. Saving a
// suggestion moves it to the saved places and brings in the next one, so there are always 30 to
// pick from (when Google found that many). Most reviewed first: the map labels pins in this order.
export function topSuggestions(
  places: SuggestedPlace[],
  savedIds: ReadonlySet<string>,
): SuggestedPlace[] {
  let unsaved = 0;
  return places
    .filter((place) => savedIds.has(place.providerPlaceId) || unsaved++ < MAX_SUGGESTIONS)
    .sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0));
}

// The places list's orders: the best rated, the most reviewed, or (in the city) the closest
export type PlaceSort = 'rating' | 'reviews' | 'distance';

type Sortable = { info: { rating?: number; ratingCount?: number }; distance?: number };

const byRating = (a: Sortable, b: Sortable) => (b.info.rating ?? 0) - (a.info.rating ?? 0);
const byReviews = (a: Sortable, b: Sortable) =>
  (b.info.ratingCount ?? 0) - (a.info.ratingCount ?? 0);
const byDistance = (a: Sortable, b: Sortable) =>
  (a.distance ?? Infinity) - (b.distance ?? Infinity);

// Each order breaks its ties with the next: Google shows ratings to one decimal, so many places
// share a 4.5, and among those the one more people rated comes first. Places without a rating
// (saved outside the searched area, a square nobody rates) go last.
const COMPARE: Record<PlaceSort, (a: Sortable, b: Sortable) => number> = {
  rating: (a, b) => byRating(a, b) || byReviews(a, b),
  reviews: (a, b) => byReviews(a, b) || byRating(a, b),
  distance: (a, b) => byDistance(a, b) || byRating(a, b) || byReviews(a, b),
};

// A sorted copy (the list's rows are rebuilt each render, but sort() would change them in place)
export function sortPlaces<T extends Sortable>(rows: T[], sort: PlaceSort): T[] {
  return [...rows].sort(COMPARE[sort]);
}
