import type { PlaceKind } from '@convex/schema';
import * as SecureStore from 'expo-secure-store';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import type { ColorValue } from 'react-native';
import { PLACE_MODES } from './place-modes';

// Where the side picked last time is kept on the phone. SecureStore is already in the app (Clerk
// keeps its session there); a one-word setting fits fine.
const STORAGE_KEY = 'wanderlog.placeKind';

type Filters = Record<PlaceKind, string | null>;

const PlaceModeContext = createContext<{
  kind: PlaceKind;
  setKind: (kind: PlaceKind) => void;
  filters: Filters;
  setFilters: (filters: Filters) => void;
} | null>(null);

// Which side the map and places tabs show, and each side's filter chip. Lives in the tabs
// layout, above both tabs, so the switch and chips on one tab change the other too. The side is
// remembered between app launches; the chips start on "All".
export function PlaceModeProvider({ children }: { children: ReactNode }) {
  const [kind, setKindState] = useState<PlaceKind>('sight');
  const [filters, setFilters] = useState<Filters>({ sight: null, sweet: null });

  // The side picked last time. Reading takes a moment, so sights show first.
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'sight' || saved === 'sweet') setKindState(saved);
      })
      // Not remembered: start on sights, as on a first launch
      .catch(() => undefined);
  }, []);

  function setKind(next: PlaceKind) {
    setKindState(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => undefined);
  }

  return (
    <PlaceModeContext value={{ kind, setKind, filters, setFilters }}>{children}</PlaceModeContext>
  );
}

export function usePlaceMode() {
  const context = use(PlaceModeContext);
  if (context === null) throw new Error('usePlaceMode needs a PlaceModeProvider above it');
  const { kind, setKind, filters, setFilters } = context;
  const mode = PLACE_MODES[kind];
  return {
    kind,
    mode,
    setKind,
    // The chip picked on this side, or null for "All"
    filter: mode.filters.find((filter) => filter.id === filters[kind]) ?? null,
    setFilterId: (id: string | null) => setFilters({ ...filters, [kind]: id }),
  };
}

// The places tab's icon follows the switch: a landmark for sights, a croissant for sweet spots
export function PlacesTabIcon({ color, size }: { color: ColorValue; size: number }) {
  const { mode } = usePlaceMode();
  const ModeIcon = mode.icon;
  return <ModeIcon color={color} size={size} />;
}
