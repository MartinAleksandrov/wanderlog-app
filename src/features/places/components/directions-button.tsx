import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { openDirections, type Destination } from '@/lib/directions';
import { cn } from '@/lib/utils';
import { CornerUpRightIcon } from 'lucide-react-native';

type DirectionsButtonProps = {
  destination: Destination;
  // Round icon-only button (the map pop-up) or a labelled one (lists and the details sheet)
  withLabel?: boolean;
  className?: string;
};

// Directions to a place in Google Maps, in Google Maps' own look: blue with a turn arrow. Used
// on the map's pop-up, the places list and the details sheet.
export function DirectionsButton({ destination, withLabel, className }: DirectionsButtonProps) {
  return (
    <Button
      size={withLabel ? 'sm' : 'icon'}
      aria-label="Directions"
      accessibilityHint="Opens directions in Google Maps"
      className={cn(
        'bg-blue-600 active:bg-blue-700',
        withLabel ? undefined : 'rounded-full',
        className,
      )}
      onPress={() => openDirections(destination)}
    >
      <Icon
        as={CornerUpRightIcon}
        strokeWidth={2.5}
        className={cn('text-white', withLabel ? 'size-4' : 'size-5')}
      />
      {withLabel ? <Text className="text-white">Directions</Text> : null}
    </Button>
  );
}
