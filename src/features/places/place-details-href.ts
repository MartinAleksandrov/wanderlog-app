import type { Doc } from '@convex/_generated/dataModel';
import type { PlaceKind } from '@convex/schema';
import { placeKindOf } from './place-modes';

// The details sheet's route params (src/app/place/[placeId].tsx). The name and photo come from
// the tapped card, so the top of the sheet shows at once while the rest loads. `kind` is the side
// it was opened from, so its button saves to the same list: the sheet sits outside the tabs, so
// it can't see their switch.
export type PlaceDetailsParams = {
  placeId: string;
  name?: string;
  photoName?: string;
  kind?: string;
};

// Where router.push goes to open a place's details sheet
export function placeDetailsHref(place: {
  placeId: string;
  name: string;
  photoName?: string;
  kind: PlaceKind;
}) {
  return {
    pathname: '/place/[placeId]',
    params: {
      placeId: place.placeId,
      name: place.name,
      photoName: place.photoName ?? '',
      kind: place.kind,
    },
  } as const;
}

// The same for a place saved to the trip, on the side it was saved on. null without a Google
// place ID: there's nothing to look up.
export function savedPlaceDetailsHref(place: Doc<'places'>) {
  if (place.providerPlaceId === undefined) return null;
  return placeDetailsHref({
    placeId: place.providerPlaceId,
    name: place.name,
    photoName: place.photoName,
    kind: placeKindOf(place),
  });
}
