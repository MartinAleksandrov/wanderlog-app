import type { PlaceKind } from '@convex/schema';
import { PLACE_KINDS } from './place-modes';

// How far (dp) or how fast (dp per second) a sideways swipe must go to switch sides. A short,
// slow drag is taken as the finger wobbling, not a swipe.
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 500;

// The side a sideways swipe on the places list leads to, in the switch's order (sights, sweet
// spots, restaurants). Swiping left (the finger moves towards the left edge, so translationX is
// negative) goes to the next side, like turning a page; swiping right goes back. A swipe that's
// too short and too slow, one flicked back the other way at the end, or one past the first or
// last side stays on `kind`.
export function sideAfterSwipe(
  kind: PlaceKind,
  translationX: number,
  velocityX: number,
): PlaceKind {
  const isFar = Math.abs(translationX) >= SWIPE_DISTANCE;
  const isFlick = Math.abs(velocityX) >= SWIPE_VELOCITY;
  const flickedBack = isFlick && Math.sign(velocityX) !== Math.sign(translationX);
  if (flickedBack || (!isFar && !isFlick)) return kind;

  const step = translationX < 0 ? 1 : -1;
  return PLACE_KINDS[PLACE_KINDS.indexOf(kind) + step] ?? kind;
}

// 1 when `to` comes after `from` in the switch's order, -1 when before: which way the new side
// slides in, whether it was swiped to or tapped on the switch
export function stepBetween(from: PlaceKind, to: PlaceKind): 1 | -1 {
  return PLACE_KINDS.indexOf(to) > PLACE_KINDS.indexOf(from) ? 1 : -1;
}
