import { PlacePhoto } from '@/components/place-photo';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { DirectionsButton, PLACE_MODES, placeKindOf } from '@/features/places';
import { cn } from '@/lib/utils';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, XIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import type { Stop } from '../use-itinerary';

type StopRowProps = {
  stop: Stop;
  // Its number in the day: 1, 2, 3…
  number: number;
  isFirst: boolean;
  isLast: boolean;
  // Edit mode shows ▲ ▼ ✕ instead of Directions
  isEditing: boolean;
  onToggleDone: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
  // Tapping the row opens the place's details sheet
  onOpen: () => void;
};

// One stop of the day. The round number is in the place's colour (purple for sights, chocolate
// for sweet spots); tapping it ticks the stop off (green check, name crossed out) and back.
// Normally there's a Directions button; while editing, buttons to move it up, down or off the
// day (the place stays saved to the trip).
export function StopRow({
  stop,
  number,
  isFirst,
  isLast,
  isEditing,
  onToggleDone,
  onMove,
  onRemove,
  onOpen,
}: StopRowProps) {
  const { place } = stop;
  const mode = PLACE_MODES[placeKindOf(place)];

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityHint="Shows more about this place"
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-2.5 active:bg-accent"
    >
      <Pressable
        onPress={onToggleDone}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: stop.done === true }}
        accessibilityLabel={stop.done ? `${place.name}, done` : `Mark ${place.name} as done`}
        className={cn(
          'size-8 items-center justify-center rounded-full',
          stop.done ? 'bg-green-600' : mode.pins.saved.dot,
        )}
      >
        {stop.done ? (
          <Icon as={CheckIcon} strokeWidth={3} className="size-4 text-white" />
        ) : (
          <Text className="text-sm font-bold text-white">{number}</Text>
        )}
      </Pressable>
      <PlacePhoto
        photoName={place.photoName}
        category={place.category}
        width={200}
        className={cn('size-14 rounded-xl', stop.done && 'opacity-50')}
      />
      <View className="flex-1 gap-0.5">
        <Text
          numberOfLines={2}
          className={cn('font-semibold', stop.done && 'text-muted-foreground line-through')}
        >
          {place.name}
        </Text>
        <View className="flex-row items-center gap-1">
          <Icon as={mode.icon} className="size-3.5 text-muted-foreground" />
          <Text variant="muted" numberOfLines={1} className="shrink">
            {place.category ?? mode.label}
          </Text>
        </View>
      </View>
      {isEditing ? (
        <View className="flex-row">
          <EditButton
            icon={ChevronUpIcon}
            label="Move up"
            disabled={isFirst}
            onPress={() => onMove('up')}
          />
          <EditButton
            icon={ChevronDownIcon}
            label="Move down"
            disabled={isLast}
            onPress={() => onMove('down')}
          />
          <EditButton icon={XIcon} label="Remove from this day" onPress={onRemove} />
        </View>
      ) : (
        <DirectionsButton
          destination={{
            name: place.name,
            coordinates: place.coordinates,
            providerPlaceId: place.providerPlaceId,
          }}
          className="size-9"
        />
      )}
    </Pressable>
  );
}

function EditButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: typeof XIcon;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      disabled={disabled}
      className="size-9 rounded-full"
      onPress={onPress}
    >
      <Icon as={icon} className="size-5 text-muted-foreground" />
    </Button>
  );
}
