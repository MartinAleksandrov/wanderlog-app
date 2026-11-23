import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { PlaceKind } from '@convex/schema';
import { Pressable, View } from 'react-native';
import { PLACE_MODES } from '../place-modes';

const KINDS: PlaceKind[] = ['sight', 'sweet'];

// The "Sights | Sweet spots" switch at the top of the map and places tabs. The selected side
// is filled with its own colour (orange or pink), so the whole screen's theme is announced
// right where you flip it.
export function ModeSwitch({
  kind,
  onChange,
  className,
}: {
  kind: PlaceKind;
  onChange: (kind: PlaceKind) => void;
  className?: string;
}) {
  return (
    <View
      accessibilityRole="tablist"
      className={cn('flex-row self-center rounded-full bg-background p-1 shadow-md', className)}
    >
      {KINDS.map((option) => {
        const mode = PLACE_MODES[option];
        const isSelected = option === kind;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange(option)}
            className={cn(
              'flex-row items-center gap-1.5 rounded-full px-4 py-2',
              isSelected ? mode.switchActive : 'active:bg-accent',
            )}
          >
            <Icon
              as={mode.icon}
              className={cn('size-4', isSelected ? 'text-white' : 'text-muted-foreground')}
            />
            <Text
              className={cn(
                'text-sm font-semibold',
                isSelected ? 'text-white' : 'text-muted-foreground',
              )}
            >
              {mode.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
