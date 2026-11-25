import type { Doc } from '../_generated/dataModel';
import type { PlaceKind } from '../schema';

// Which list a saved place is on. Places saved before sweet spots existed have no kind: 'sight'.
// Shared by the backend and the app (only type imports, so the app bundles no server code), so
// both sides read old places the same way.
export function placeKindOf(place: Pick<Doc<'places'>, 'kind'>): PlaceKind {
  return place.kind ?? 'sight';
}
