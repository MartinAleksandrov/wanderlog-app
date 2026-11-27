import { Icon } from '@/components/ui/icon';
import { ArrowUpIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

// The round "back to top" button floating at the bottom right of a long list. It fades in and
// out, so it doesn't pop over the cards. The same size and shadow as the map's locate button.
export function BackToTopButton({ onPress }: { onPress: () => void }) {
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      className="absolute right-4 bottom-4"
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Back to top"
        className="size-12 items-center justify-center rounded-full bg-background shadow-md active:bg-accent"
      >
        <Icon as={ArrowUpIcon} className="size-5 text-foreground" />
      </Pressable>
    </Animated.View>
  );
}
