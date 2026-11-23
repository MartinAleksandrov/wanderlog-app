import { ZoomIn } from 'react-native-reanimated';

// The little "pop" of a saved mark (the check or the heart) appearing: it grows from nothing and
// overshoots a bit, like a spring. Used with LayoutAnimationConfig skipEntering, so marks that
// are already there when a card first shows stay still; only a place being saved pops.
export const SAVED_POP = ZoomIn.springify().damping(9).stiffness(260);
