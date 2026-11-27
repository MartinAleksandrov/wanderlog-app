import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { usePanGesture } from 'react-native-gesture-handler';
import type Animated from 'react-native-reanimated';
import {
  measure,
  scrollTo,
  useAnimatedRef,
  useFrameCallback,
  useScrollOffset,
  useSharedValue,
  withTiming,
  type AnimatedRef,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { WALK_LEG_HEIGHT } from './components/walk-leg';
import { dropIndex, rowAt, topOf } from './reorder';
import { isPending, type Stop } from './use-itinerary';

// How long a stop must be held before it lifts. Moving the finger sooner is a scroll.
const LIFT_AFTER_MS = 350;
// Holding the stop this close (dp) to the top of the list, or to the bin, scrolls the list
const EDGE = 72;
// The fastest the list scrolls by itself, in dp per frame
const MAX_SCROLL_STEP = 12;
// How far around the bin (dp) still counts as on it
const BIN_SLOP = 24;
// How long the floating copy takes to settle into its slot, or to shrink into the bin
const DROP_MS = 160;

// The stop lifted: where it was (0 = first) and the day's other stops, in order, at that moment
type Lifted = { stop: Stop; index: number; others: Stop[] };

// Where the stop list is when a long press starts: from the top-left of the layer, its width,
// and its top on the screen
type ListBox = { top: number; left: number; width: number; pageY: number };

type DropHandlers = {
  // Dropped right before `before`, or at the end of the day (null)
  onMove: (stop: Stop, before: Stop | null) => void;
  // Dropped on the bin
  onRemove: (stop: Stop) => void;
};

// Dragging the plan's stops: hold one to lift it, move it up or down the day, drop it in its new
// place or on the bin. The stop itself stays in the list as an empty slot that moves as the
// finger does; a floating copy follows the finger, drawn on a layer over the whole screen so it
// can reach the bin. The finger, the copy and the slot maths run on the UI thread (shared
// values, a frame callback), so the drag keeps up with the finger. React only hears about the
// lift, each new slot and the drop.
//
// The native views it measures come back as refs of their own (scrollRef…), apart from `drag`:
// the React Compiler treats an object holding a ref as a ref, which can't be read while
// rendering. Shared values are read and written with get() and set() for the same reason.
export function useStopDrag({ onMove, onRemove }: DropHandlers) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  // The full-screen layer the floating copy and the bin are drawn on
  const layerRef = useAnimatedRef<Animated.View>();
  const listRef = useAnimatedRef<Animated.View>();
  const binRef = useAnimatedRef<Animated.View>();
  const scrollOffset = useScrollOffset(scrollRef);

  const shared = {
    // idle; lifting (held long enough, React is finding the row); lifted; dropping (the copy
    // settles). One drag at a time.
    phase: useSharedValue<'idle' | 'lifting' | 'lifted' | 'dropping'>('idle'),
    // Where the row was when lifted: from the top-left of the layer, and on the screen (pageY)
    start: useSharedValue({ top: 0, left: 0, width: 0, height: 0, pageY: 0 }),
    // How far the finger has moved up or down since, and where it is on the screen now. Worked
    // out from where the press started (pressY), not Gesture Handler's translationY, which starts
    // again from the first move after the long press.
    translationY: useSharedValue(0),
    finger: useSharedValue({ x: 0, y: 0 }),
    pressY: useSharedValue(0),
    // Where the stop would land, and the other rows' heights the slot maths needs
    slot: useSharedValue(0),
    otherHeights: useSharedValue<number[]>([]),
    isOverBin: useSharedValue(false),
    // 0 → 1 while the copy shrinks into the bin
    removing: useSharedValue(0),
  };
  const { phase, start, translationY, finger, slot, otherHeights, isOverBin } = shared;

  // React's side: the stop lifted (for the copy, the bin and the empty slot) and its slot
  const [lifted, setLifted] = useState<Lifted | null>(null);
  const [target, setTarget] = useState(0);
  const liftedRef = useRef<Lifted | null>(null);
  // Each row's height, from its layout
  const heights = useRef(new Map<string, number>());
  // The latest drop handlers, for a drop that a callback from an earlier render reports
  const handlers = useRef({ onMove, onRemove });
  useEffect(() => {
    handlers.current = { onMove, onRemove };
  });

  function onSlotChange(next: number) {
    setTarget(next);
    void Haptics.selectionAsync();
  }

  function onBinReached() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  // Every frame while a stop is lifted: is the finger on the bin, should the list scroll, and
  // which slot is the copy over now
  const frame = useFrameCallback(() => {
    'worklet';
    if (phase.get() !== 'lifted') return;
    const list = measure(listRef);
    const scroll = measure(scrollRef);
    if (list === null || scroll === null) return;
    const bin = measure(binRef);
    const { x, y } = finger.get();

    // Anywhere below the bin's top edge, around it, counts
    const onBin =
      bin !== null &&
      x > bin.pageX - BIN_SLOP &&
      x < bin.pageX + bin.width + BIN_SLOP &&
      y > bin.pageY - BIN_SLOP;
    if (onBin !== isOverBin.get()) {
      isOverBin.set(onBin);
      if (onBin) scheduleOnRN(onBinReached);
    }
    // On the bin, the rows stay where they are
    if (onBin) return;

    // Near the top, or just above the bin: scroll that way, faster the closer the finger is
    const top = scroll.pageY + EDGE;
    const bottom = (bin === null ? scroll.pageY + scroll.height : bin.pageY - BIN_SLOP) - EDGE;
    const step =
      y < top
        ? -MAX_SCROLL_STEP * Math.min(1, (top - y) / EDGE)
        : y > bottom
          ? MAX_SCROLL_STEP * Math.min(1, (y - bottom) / EDGE)
          : 0;
    if (step !== 0) scrollTo(scrollRef, 0, Math.max(0, scrollOffset.get() + step), false);

    const { pageY, height } = start.get();
    const next = dropIndex({
      heights: otherHeights.get(),
      liftedHeight: height,
      gap: WALK_LEG_HEIGHT,
      center: pageY + height / 2 + translationY.get() - list.pageY,
      index: slot.get(),
    });
    if (next !== slot.get()) {
      slot.set(next);
      scheduleOnRN(onSlotChange, next);
    }
  }, false);

  // A long press at `y` dp from the top of the list: lift the stop there. On a walk between two
  // stops, or on a stop added a moment ago that the server hasn't confirmed, nothing lifts.
  function lift(y: number, box: ListBox, dayStops: Stop[]) {
    const rowHeights = dayStops.map((stop) => heights.current.get(stop._id) ?? 0);
    const index = rowAt(rowHeights, WALK_LEG_HEIGHT, y);
    const stop = dayStops[index];
    if (stop === undefined || isPending(stop)) {
      phase.set('idle');
      return;
    }
    const height = rowHeights[index] ?? 0;
    const rowTop = topOf(rowHeights, index, WALK_LEG_HEIGHT);
    start.set({
      top: box.top + rowTop,
      left: box.left,
      width: box.width,
      height,
      pageY: box.pageY + rowTop,
    });
    otherHeights.set(rowHeights.filter((_, other) => other !== index));
    slot.set(index);
    phase.set('lifted');

    liftedRef.current = { stop, index, others: dayStops.filter((other) => other !== stop) };
    setLifted(liftedRef.current);
    setTarget(index);
    frame.setActive(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  // The copy has settled (or the drag was cut short): show the stop in the list again and save
  // its new place. The plan changes optimistically in the same render, so the row reappears
  // right where the copy was.
  function drop(outcome: 'move' | 'remove' | 'cancel', at: number) {
    frame.setActive(false);
    const current = liftedRef.current;
    liftedRef.current = null;
    if (current !== null && outcome === 'remove') {
      handlers.current.onRemove(current.stop);
    } else if (current !== null && outcome === 'move' && at !== current.index) {
      handlers.current.onMove(current.stop, current.others[at] ?? null);
    }
    setLifted(null);
    phase.set('idle');
  }

  const drag = {
    shared,
    lifted,
    target,
    lift,
    drop,
    setHeight: (stopId: string, height: number) => heights.current.set(stopId, height),
  };
  return { drag, scrollRef, layerRef, listRef, binRef };
}

export type StopDrag = ReturnType<typeof useStopDrag>['drag'];

// The long press that lifts a stop, and the drag that follows. It sits on the whole list, not
// on each row: the rows change places during the drag, and Android moves a row's view by taking
// it out and putting it back, which would cancel a gesture attached to it.
// The callbacks run on the UI thread (Gesture Handler's default with Reanimated), so the copy
// moves with the finger without a trip to JavaScript; only the lift and the drop go there
// (scheduleOnRN).
export function useListDragGesture({
  drag,
  listRef,
  layerRef,
  onLift,
}: {
  drag: StopDrag;
  listRef: AnimatedRef<Animated.View>;
  layerRef: AnimatedRef<Animated.View>;
  // Held at `y` dp from the top of the list, which is at `box`
  onLift: (y: number, box: ListBox) => void;
}) {
  const { phase, start, translationY, finger, pressY, slot, otherHeights, isOverBin, removing } =
    drag.shared;
  const { drop } = drag;

  return usePanGesture({
    activateAfterLongPress: LIFT_AFTER_MS,
    maxPointers: 1,
    onActivate: (event) => {
      'worklet';
      // A stop is still settling from the last drag
      if (phase.get() !== 'idle') return;
      const list = measure(listRef);
      const layer = measure(layerRef);
      if (list === null || layer === null) return;
      phase.set('lifting');
      translationY.set(0);
      finger.set({ x: event.absoluteX, y: event.absoluteY });
      pressY.set(event.absoluteY);
      isOverBin.set(false);
      removing.set(0);
      scheduleOnRN(onLift, event.y, {
        top: list.pageY - layer.pageY,
        left: list.pageX - layer.pageX,
        width: list.width,
        pageY: list.pageY,
      });
    },
    onUpdate: (event) => {
      'worklet';
      const current = phase.get();
      if (current !== 'lifting' && current !== 'lifted') return;
      translationY.set(event.absoluteY - pressY.get());
      finger.set({ x: event.absoluteX, y: event.absoluteY });
    },
    onDeactivate: (event) => {
      'worklet';
      const current = phase.get();
      if (current !== 'lifting' && current !== 'lifted') return;
      phase.set('dropping');
      const at = slot.get();
      // Let go before React found the row, or something else took the touch
      if (current === 'lifting' || event.canceled) {
        scheduleOnRN(drop, 'cancel', at);
      } else if (isOverBin.get()) {
        removing.set(
          withTiming(1, { duration: DROP_MS }, () => {
            scheduleOnRN(drop, 'remove', at);
          }),
        );
      } else {
        // Glide into the slot: the list's top, the rows before the slot and their gaps
        const list = measure(listRef);
        const layer = measure(layerRef);
        const { top } = start.get();
        const slotTop =
          list === null || layer === null
            ? top
            : list.pageY - layer.pageY + topOf(otherHeights.get(), at, WALK_LEG_HEIGHT);
        translationY.set(
          withTiming(slotTop - top, { duration: DROP_MS }, () => {
            scheduleOnRN(drop, 'move', at);
          }),
        );
      }
    },
  });
}
