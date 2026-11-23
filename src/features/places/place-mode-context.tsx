import type { PlaceKind } from '@convex/schema';
import { createContext, use, useState, type ReactNode } from 'react';
import type { ColorValue } from 'react-native';
import { PLACE_MODES } from './place-modes';

const PlaceModeContext = createContext<{
  kind: PlaceKind;
  setKind: (kind: PlaceKind) => void;
} | null>(null);

// Which side the map and places tabs show. Lives in the tabs layout, above both tabs, so the
// switch on one tab flips the other too. Starts on sights each time the app opens.
export function PlaceModeProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<PlaceKind>('sight');
  return <PlaceModeContext value={{ kind, setKind }}>{children}</PlaceModeContext>;
}

export function usePlaceMode() {
  const context = use(PlaceModeContext);
  if (context === null) throw new Error('usePlaceMode needs a PlaceModeProvider above it');
  return { kind: context.kind, mode: PLACE_MODES[context.kind], setKind: context.setKind };
}

// The places tab's icon follows the switch: a landmark for sights, a croissant for sweet spots
export function PlacesTabIcon({ color, size }: { color: ColorValue; size: number }) {
  const { mode } = usePlaceMode();
  const ModeIcon = mode.icon;
  return <ModeIcon color={color} size={size} />;
}
