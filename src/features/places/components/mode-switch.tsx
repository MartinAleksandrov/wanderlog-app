import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { PlaceKind } from '@convex/schema';
import { Pressable, View } from 'react-native';
import { PLACE_KINDS, PLACE_MODES } from '../place-modes';

// The "Sights | Sweet spots | Restaurants" switch at the top of the map and places tabs. The
// selected side is filled with its own colour (orange, pink or red) and named, so the whole
// screen's theme is announced right where you flip it. The other sides show only their icon:
// three names side by side, plus the map's filter button, don't fit on a phone.
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
      {PLACE_KINDS.map((option) => {
        const mode = PLACE_MODES[option];
        const isSelected = option === kind;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityLabel={mode.label}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange(option)}
            className={cn(
              'flex-row items-center gap-1.5 rounded-full py-2',
              isSelected ? cn('px-4', mode.switchActive) : 'px-3 active:bg-accent',
            )}
          >
            <Icon
              as={mode.icon}
              className={cn('size-4', isSelected ? 'text-white' : 'text-muted-foreground')}
            />
            {isSelected ? (
              <Text className="text-sm font-semibold text-white">{mode.label}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
