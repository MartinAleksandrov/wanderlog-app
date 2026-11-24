import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { SlidersHorizontalIcon, XIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import type { PlaceMode } from '../place-modes';

type FilterButtonProps = {
  mode: PlaceMode;
  // How many filters are on (a kind and/or "Open now"): 0, 1 or 2
  activeCount: number;
  isOpen: boolean;
  onPress: () => void;
};

// The round button next to the map's side switch that opens the filter panel. With a filter on
// it's filled with the side's colour and shows how many are on, so a filtered map is never a
// surprise; while the panel is open it shows a ✕ to close it.
export function FilterButton({ mode, activeCount, isOpen, onPress }: FilterButtonProps) {
  const isActive = activeCount > 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isActive ? `Filters, ${activeCount} on` : 'Filters'}
      accessibilityState={{ expanded: isOpen }}
      className={cn(
        'size-12 items-center justify-center rounded-full shadow-md',
        isActive ? mode.switchActive : 'bg-background active:bg-accent',
      )}
    >
      <Icon
        as={isOpen ? XIcon : SlidersHorizontalIcon}
        className={cn('size-5', isActive ? 'text-white' : 'text-foreground')}
      />
      {isActive && !isOpen ? (
        <View className="absolute -top-0.5 -right-0.5 size-5 items-center justify-center rounded-full border-2 border-white bg-foreground">
          <Text className="text-[10px] leading-3 font-bold text-background">{activeCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
