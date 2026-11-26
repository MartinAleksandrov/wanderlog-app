import type { Coordinates } from '@convex/schema';
import { useRef, useState, type RefObject } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import type MapView from 'react-native-maps';

// How much of the map's bottom the pin pop-up covers: the card (about 250-300 dp, depending on
// whether there's a description) plus the 40 dp under it that keeps Google's logo visible
const CARD_COVER = 340;
// A pin's tip this close above the card still counts as hidden: its label would touch the card
const MARGIN = 24;
// A full pin from its tip to the top of its label (40 dp label on an 8 dp tail)
const PIN_HEIGHT = 48;

// Keeps a tapped pin in view: when the pop-up would cover it, the map slides up just enough to
// put the pin in the middle of the free strip between the cards at the top (search bar, switch,
// status, chips) and the pop-up. Pins already in that strip don't move the map at all.
//
// That slide isn't the user moving the map, so it mustn't bring up "Search this area" (which
// compares the searched area with where the user has taken the map). takeRevealMove() tells
// the map screen which move was ours.
export function useRevealPin(mapRef: RefObject<MapView | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Where the cards at the top end, in dp from the map's top (they change height while
  // exploring a city or when the chips show)
  const [topCover, setTopCover] = useState(0);
  // Set from the moment reveal() moves the map until that move ends
  const isRevealing = useRef(false);

  async function reveal(coordinates: Coordinates) {
    const map = mapRef.current;
    if (map === null || size.height === 0) return;
    // The map refuses to convert points while it's still loading, or while another trip's map
    // replaces it. The pin then simply stays where it is: the pop-up still opens, and nothing is
    // left as an unhandled error.
    try {
      // Where the pin's tip is on screen, in dp from the map's top left
      const point = await map.pointForCoordinate(coordinates);
      const freeBottom = size.height - CARD_COVER;
      if (point.y < freeBottom - MARGIN) return;
      // The middle of the free strip, a little lower because the label stands above the tip
      const target = Math.min(
        topCover + Math.max(freeBottom - topCover, 0) / 2 + PIN_HEIGHT / 2,
        freeBottom - MARGIN,
      );
      // Moving the map's centre by the same distance moves the pin there
      const center = await map.coordinateForPoint({
        x: size.width / 2,
        y: size.height / 2 + (point.y - target),
      });
      isRevealing.current = true;
      map.animateCamera({ center }, { duration: 350 });
    } catch {
      isRevealing.current = false;
    }
  }

  return {
    reveal,
    // The map's size, needed to know where the pop-up starts
    onLayout: ({ nativeEvent }: LayoutChangeEvent) =>
      setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height }),
    // The top cards' size; their y already includes the status bar's height
    onTopLayout: ({ nativeEvent }: LayoutChangeEvent) =>
      setTopCover(nativeEvent.layout.y + nativeEvent.layout.height),
    // Call when a map move ends: true when it was reveal()'s slide rather than the user
    takeRevealMove: (isGesture: boolean | undefined) => {
      const wasReveal = isRevealing.current && isGesture !== true;
      isRevealing.current = false;
      return wasReveal;
    },
  };
}
