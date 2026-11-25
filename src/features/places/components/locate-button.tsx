import { Icon } from '@/components/ui/icon';
import { LocateFixedIcon, LocateIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable } from 'react-native';

type LocateButtonProps = {
  // The location is allowed: the icon turns blue, like the dot it flies to
  isOn: boolean;
  // Waiting for a GPS fix: spins, and ignores taps
  isLocating: boolean;
  onPress: () => void;
};

// The round "show me where I am" button at the map's bottom right (see use-locate-me.ts). The
// same size and shadow as the filter button at the top.
export function LocateButton({ isOn, isLocating, onPress }: LocateButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={isLocating}
      accessibilityRole="button"
      accessibilityLabel="Show where I am"
      accessibilityState={{ busy: isLocating }}
      className="size-12 items-center justify-center rounded-full bg-background shadow-md active:bg-accent"
    >
      {isLocating ? (
        <ActivityIndicator />
      ) : (
        <Icon
          as={isOn ? LocateFixedIcon : LocateIcon}
          className={isOn ? 'size-5 text-blue-600' : 'size-5 text-foreground'}
        />
      )}
    </Pressable>
  );
}
