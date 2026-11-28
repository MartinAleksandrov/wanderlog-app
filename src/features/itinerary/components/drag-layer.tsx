import { Icon } from '@/components/ui/icon';
import { Trash2Icon } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  ZoomIn,
  ZoomOut,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import type { Stop } from '../use-itinerary';
import type { StopDrag } from '../use-stop-drag';
import { StopRow } from './stop-row';

const HOVER = { duration: 120 };

type DragLayerProps = {
  drag: StopDrag;
  isEditing: boolean;
  layerRef: AnimatedRef<Animated.View>;
  binRef: AnimatedRef<Animated.View>;
};

// Drawn over the whole plan screen while a stop is dragged: the floating copy of the stop under
// the finger, and the bin at the bottom to drop it on. Touches go through to the list (the drag
// itself is the row's gesture), so the layer never gets in the way.
export function DragLayer({ drag, isEditing, layerRef, binRef }: DragLayerProps) {
  return (
    <Animated.View ref={layerRef} pointerEvents="none" className="absolute inset-0">
      {drag.lifted ? (
        <>
          <FloatingStop
            drag={drag}
            stop={drag.lifted.stop}
            number={drag.target + 1}
            isEditing={isEditing}
          />
          <Bin
            binRef={binRef}
            isOverBin={drag.shared.isOverBin}
            isLaidOut={drag.shared.isBinLaidOut}
          />
        </>
      ) : null}
    </Animated.View>
  );
}

// The lifted stop, a little bigger and with a shadow, where the finger holds it. Its number is
// the one it would get if dropped now. Over the bin it shrinks a little; dropped there it
// shrinks away.
function FloatingStop({
  drag,
  stop,
  number,
  isEditing,
}: {
  drag: StopDrag;
  stop: Stop;
  number: number;
  isEditing: boolean;
}) {
  const { start, translationY, isOverBin, removing } = drag.shared;
  const style = useAnimatedStyle(() => {
    const { top, left, width } = start.get();
    const isOver = isOverBin.get();
    const gone = removing.get();
    return {
      top: top + translationY.get(),
      left,
      width,
      opacity: (isOver ? 0.85 : 1) * (1 - gone),
      transform: [{ scale: withTiming(isOver ? 0.85 : 1.03, HOVER) }, { scale: 1 - 0.5 * gone }],
    };
  });

  return (
    <Animated.View style={style} className="absolute rounded-2xl shadow-lg">
      <StopRow
        stop={stop}
        number={number}
        isFirst={false}
        isLast={false}
        isEditing={isEditing}
        onToggleDone={noop}
        onMove={noop}
        onRemove={noop}
        onOpen={noop}
      />
    </Animated.View>
  );
}

// The bin: a red circle at the bottom, above the tab bar. It grows when the finger is on it.
// Once laid out, it tells the drag it can be measured.
function Bin({
  binRef,
  isOverBin,
  isLaidOut,
}: {
  binRef: AnimatedRef<Animated.View>;
  isOverBin: SharedValue<boolean>;
  isLaidOut: SharedValue<boolean>;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(isOverBin.get() ? 1.25 : 1, HOVER) }],
  }));
  return (
    <View className="absolute inset-x-0 bottom-6 items-center">
      <Animated.View
        ref={binRef}
        entering={ZoomIn.duration(150)}
        exiting={ZoomOut.duration(150)}
        onLayout={() => isLaidOut.set(true)}
      >
        <Animated.View
          style={style}
          accessibilityLabel="Drop here to remove from this day"
          className="size-16 items-center justify-center rounded-full bg-red-600 shadow-lg"
        >
          <Icon as={Trash2Icon} className="size-7 text-white" />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function noop() {}
