import { matchesFilter, type PlaceFilter, type PlaceMode } from './place-modes';

// What the filters look at in a place: its kind ("Coffee Shop") and whether it's open right now
export type FilterablePlace = { category?: string; isOpen: boolean };

// The filters picked: a kind chip (Coffee, Parks…; null for All) and "Open now"
export type PlaceFilters = { filter: PlaceFilter | null; openNow: boolean };

export function passesFilters(place: FilterablePlace, { filter, openNow }: PlaceFilters): boolean {
  // Hours unknown counts as not open, as in Google Maps
  if (openNow && !place.isOpen) return false;
  // Places without a category show under All, and under "Other" where a side has it
  return filter === null || matchesFilter(place.category, filter);
}

export function isFiltered({ filter, openNow }: PlaceFilters): boolean {
  return filter !== null || openNow;
}

// The chips to show and how many places each would show if tapped, keeping the other filter as it
// is: a kind chip counts only open places while "Open now" is on, and "Open now" counts only the
// picked kind. Only kinds with places here get a chip, so a small town doesn't offer empty ones;
// the picked kind keeps its chip even with none, so it can be switched off.
export function chipCounts(mode: PlaceMode, places: FilterablePlace[], filters: PlaceFilters) {
  const count = (picked: PlaceFilters) =>
    places.filter((place) => passesFilters(place, picked)).length;
  return {
    kinds: mode.filters
      .map((filter) => ({ filter, count: count({ filter, openNow: filters.openNow }) }))
      .filter(({ filter, count }) => count > 0 || filter.id === filters.filter?.id),
    open: count({ filter: filters.filter, openNow: true }),
  };
}
