import type { Coordinates } from '@convex/schema';
import type { Region } from 'react-native-maps';

// How big a pin is drawn (see place-pin.tsx):
//   full    = photo and name label, hanging above the spot
//   compact = just the photo, hanging above the spot
//   mini    = a small coloured dot on the spot
export type PinSize = 'full' | 'compact' | 'mini';

type PinToPlace = { key: string; name: string; coordinates: Coordinates };

// Where a pin's body is on screen, in dp relative to its spot. Full and compact bodies are 40 dp
// tall and sit on an 8 dp tail that points at the spot; a label grows with the name up to 176 dp
// (max-w-44); a mini dot is 18 dp, centred on the spot. The selected pin has a 3 dp ring around
// its body.
const BODY_HEIGHT = 40;
const TAIL_HEIGHT = 8;
const SELECTED_RING = 3;
const MAX_FULL_WIDTH = 176;
const COMPACT_WIDTH = 40;
const MINI_SIZE = 18;
// Pins may touch by a few dp; only real overlaps count
const TOUCH_ALLOWED = 4;

type Box = { left: number; right: number; top: number; bottom: number };

// A label's width, guessed from the name's length (12 px semibold text is about 6.8 dp a letter)
function fullWidth(name: string): number {
  return Math.min(MAX_FULL_WIDTH, 56 + name.length * 6.8);
}

function boxAt(x: number, y: number, size: PinSize, name: string, ring = 0): Box {
  if (size === 'mini') {
    const half = MINI_SIZE / 2;
    return { left: x - half, right: x + half, top: y - half, bottom: y + half };
  }
  const half = (size === 'full' ? fullWidth(name) : COMPACT_WIDTH) / 2 + ring;
  const bottom = y - TAIL_HEIGHT;
  return {
    left: x - half,
    right: x + half,
    top: bottom - BODY_HEIGHT - ring,
    bottom: bottom + ring,
  };
}

function collide(a: Box, b: Box): boolean {
  return (
    a.left < b.right - TOUCH_ALLOWED &&
    b.left < a.right - TOUCH_ALLOWED &&
    a.top < b.bottom - TOUCH_ALLOWED &&
    b.top < a.bottom - TOUCH_ALLOWED
  );
}

// How far north a latitude is drawn on Google's (Mercator) map, in the same units as longitude
// degrees. Lines of latitude get further apart towards the poles.
function mercatorY(latitude: number): number {
  const radians = (latitude * Math.PI) / 180;
  return (Math.log(Math.tan(Math.PI / 4 + radians / 2)) * 180) / Math.PI;
}

// Decides how big each pin is drawn, so pins don't cover each other:
// 1. Every pin takes at least a mini dot's space.
// 2. The selected pin (the one whose pop-up is open) always gets its photo and name.
// 3. Then in priority order (saved places first, then the most popular), each pin gets the
//    biggest size that covers no other pin's dot and nothing given out before: a label if it
//    fits, otherwise its photo, otherwise it stays a mini dot.
// Only mini dots can overlap each other, where places really are next to each other. Zooming in
// spreads pins apart on screen, so they grow back to photos and labels.
//
// `region` is what the map shows and `mapWidth` its width in dp; together they give how many
// dp one degree of longitude takes on screen.
export function layoutPins(
  pins: PinToPlace[],
  region: Region,
  mapWidth: number,
  selectedKey: string | null,
): Map<string, PinSize> {
  const sizes = new Map<string, PinSize>();
  const dpPerDegree = mapWidth / region.longitudeDelta;
  // A region the map hasn't measured yet (zero or invalid size): every pin a dot except the
  // selected one, until the map reports its real size
  if (!Number.isFinite(dpPerDegree) || dpPerDegree <= 0) {
    for (const pin of pins) sizes.set(pin.key, pin.key === selectedKey ? 'full' : 'mini');
    return sizes;
  }
  const placed = pins.map((pin) => {
    // Screen y grows downwards, latitude upwards
    const x = pin.coordinates.longitude * dpPerDegree;
    const y = -mercatorY(pin.coordinates.latitude) * dpPerDegree;
    return { pin, x, y, dot: boxAt(x, y, 'mini', pin.name) };
  });
  const given: Box[] = [];

  const selected = placed.find(({ pin }) => pin.key === selectedKey);
  if (selected) {
    sizes.set(selected.pin.key, 'full');
    given.push(boxAt(selected.x, selected.y, 'full', selected.pin.name, SELECTED_RING));
  }

  for (const { pin, x, y } of placed) {
    if (pin.key === selectedKey) continue;
    const fits = (box: Box) =>
      placed.every((other) => other.pin.key === pin.key || !collide(box, other.dot)) &&
      given.every((taken) => !collide(box, taken));
    const size =
      (['full', 'compact'] as const).find((candidate) => fits(boxAt(x, y, candidate, pin.name))) ??
      'mini';
    if (size !== 'mini') given.push(boxAt(x, y, size, pin.name));
    sizes.set(pin.key, size);
  }
  return sizes;
}
