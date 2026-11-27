import type { ReactNode } from 'react';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { LinearTransition, type AnimatedRef } from 'react-native-reanimated';
import { insertAt } from '../reorder';
import type { Stop, useItineraryActions } from '../use-itinerary';
import { useListDragGesture, type StopDrag } from '../use-stop-drag';
import { StopRow } from './stop-row';
import { WalkLeg } from './walk-leg';

// Rows and walks glide to their new places when the order changes: while a stop is dragged,
// after ▲ ▼, or when a stop is taken off
const GLIDE = LinearTransition.duration(180);

type SortableStopsProps = {
  stops: Stop[];
  isEditing: boolean;
  actions: ReturnType<typeof useItineraryActions>;
  onOpen: (stop: Stop) => void;
  drag: StopDrag;
  // The list itself and the layer over the screen, which the drag measures
  listRef: AnimatedRef<Animated.View>;
  layerRef: AnimatedRef<Animated.View>;
};

// The day's stops in order, with the walk between each two. Hold a stop to drag it (see
// useStopDrag): while it's lifted, the list shows the order it would make, with an empty slot
// where it would land, and the walks and numbers already worked out for that order.
export function SortableStops({
  stops,
  isEditing,
  actions,
  onOpen,
  drag,
  listRef,
  layerRef,
}: SortableStopsProps) {
  const gesture = useListDragGesture({
    drag,
    listRef,
    layerRef,
    onLift: (y, box) => drag.lift(y, box, stops),
  });

  const liftedId = drag.lifted?.stop._id;
  const lifted = stops.find((stop) => stop._id === liftedId);
  const shown =
    lifted === undefined
      ? stops
      : insertAt(
          stops.filter((stop) => stop !== lifted),
          lifted,
          drag.target,
        );

  // Walks are keyed by their place in the list, not by stop, so they stay put while the rows
  // around them change
  const rows: ReactNode[] = [];
  shown.forEach((stop, index) => {
    const previous = shown[index - 1];
    if (previous) {
      rows.push(
        // react-doctor-disable-next-line react-doctor/no-array-index-as-key
        <Animated.View key={`walk-${index}`} layout={GLIDE}>
          <WalkLeg from={previous.place.coordinates} to={stop.place.coordinates} />
        </Animated.View>,
      );
    }
    rows.push(
      <Animated.View
        key={stop._id}
        layout={GLIDE}
        onLayout={(event) => drag.setHeight(stop._id, event.nativeEvent.layout.height)}
        // The empty slot: the floating copy is drawn instead
        style={{ opacity: stop === lifted ? 0 : 1 }}
      >
        <StopRow
          stop={stop}
          number={index + 1}
          isFirst={index === 0}
          isLast={index === shown.length - 1}
          isEditing={isEditing}
          onToggleDone={() => actions.toggleDone(stop)}
          onMove={(direction) => actions.move(stop, direction)}
          onRemove={() => actions.remove(stop)}
          onOpen={() => onOpen(stop)}
        />
      </Animated.View>,
    );
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View ref={listRef}>{rows}</Animated.View>
    </GestureDetector>
  );
}
