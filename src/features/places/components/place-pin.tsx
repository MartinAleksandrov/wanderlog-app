import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { placeIcon } from '@/lib/place-icon';
import { cn } from '@/lib/utils';
import type { Coordinates, PlaceKind } from '@convex/schema';
import type { LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Marker } from 'react-native-maps';
import type { PinSize } from '../pin-layout';
import { PLACE_MODES, type PinLook } from '../place-modes';

type PlacePinProps = {
  name: string;
  // Google's place type: picks the pin's icon
  category?: string;
  coordinates: Coordinates;
  // Which side of the app it belongs to: picks the colours (see place-modes.ts)
  kind: PlaceKind;
  // Saved to the trip (solid, with a check or heart) or only suggested (white label)
  isSaved: boolean;
  // The pin whose pop-up is open: drawn with a ring around it, on top of the others
  isSelected: boolean;
  // full = icon and name, compact = icon, mini = small dot (see pin-layout.ts)
  size: PinSize;
  onPress: () => void;
};

// A map pin: a rounded label with an icon for the kind of place and its name when there's room,
// on a pointed tail whose tip marks the spot. Where pins are crowded it's just a small dot on
// the spot. The selected pin gets a soft ring in its colour. Saved places carry a check
// (sights), a heart (sweet spots) or a bookmark (restaurants), so they stand out from
// suggestions even for someone who can't tell the colours apart.
//
// No photos on pins: a search shows about 30 pins per side, and every photo is a paid Google
// request, mostly for pins nobody looks at closely. The photos are in the places list and in
// the pop-up that opens when a pin is tapped.
//
// Android draws custom pins into a picture. While tracksViewChanges is on it redraws them all
// the time, which makes the map slow, so it's switched off once the pin has been laid out.
// Switching it off takes one last picture. The parent gives the pin a new `key` when its colour,
// size or selection changes, which mounts it again so the change gets drawn. The picture is cut
// at the pin's own bounds, which is why the tail is a real triangle (made from borders) instead
// of a rotated square that would stick out and get clipped.
export function PlacePin({
  name,
  category,
  coordinates,
  kind,
  isSaved,
  isSelected,
  size,
  onPress,
}: PlacePinProps) {
  const [isLaidOut, setIsLaidOut] = useState(false);
  const mode = PLACE_MODES[kind];
  const look = mode.pins[isSaved ? 'saved' : 'suggested'];

  return (
    <Marker
      coordinate={coordinates}
      // Full and compact pins stand on their tail's tip; a mini dot sits on the spot
      anchor={size === 'mini' ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 1 }}
      tracksViewChanges={!isLaidOut}
      // The open pin on top, then the trip's own places, then suggestions
      zIndex={isSelected ? 3 : isSaved ? 2 : 1}
      onPress={onPress}
      accessibilityLabel={name}
    >
      <View className="items-center" onLayout={() => setIsLaidOut(true)}>
        {size === 'mini' ? (
          <View className={cn('size-[18px] rounded-full border-2 border-white', look.dot)} />
        ) : (
          <PinLabel name={name} look={look} isSelected={isSelected} showName={size === 'full'}>
            <PinIcon
              look={look}
              badge={isSaved ? { icon: mode.savedIcon, className: mode.pinBadge } : undefined}
              category={category}
            />
          </PinLabel>
        )}
      </View>
    </Marker>
  );
}

// The rounded label (icon, then the name when there's room) on its tail
function PinLabel({
  name,
  look,
  isSelected,
  showName,
  children,
}: {
  name: string;
  look: PinLook;
  isSelected: boolean;
  showName: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <View className={cn('rounded-full', isSelected && `p-0.75 ${look.ring}`)}>
        <View
          className={cn(
            'flex-row items-center rounded-full border-2 p-0.5',
            showName && 'max-w-44 gap-1.5 pr-3',
            look.body,
          )}
        >
          {children}
          {showName ? (
            <Text numberOfLines={1} className={cn('shrink text-xs font-semibold', look.text)}>
              {name}
            </Text>
          ) : null}
        </View>
      </View>
      {/* The tail: a downward triangle, 12 dp wide and 8 dp tall. Under the selected ring it
          moves up to touch the label. */}
      <View
        className={cn(
          'size-0 border-t-8 border-r-[6px] border-l-[6px] border-r-transparent border-l-transparent',
          look.tail,
          isSelected && '-mt-0.75',
        )}
      />
    </>
  );
}

// The round icon for the kind of place, with a badge (check, heart or bookmark) for a saved place
function PinIcon({
  look,
  badge,
  category,
}: {
  look: PinLook;
  badge?: { icon: LucideIcon; className: string };
  category?: string;
}) {
  return (
    <View className="size-8">
      <View className={cn('size-8 items-center justify-center rounded-full', look.iconCircle)}>
        <Icon as={placeIcon(category)} className={cn('size-4', look.icon)} />
      </View>
      {badge ? (
        <View className="absolute -right-0.5 -bottom-0.5 size-3.5 items-center justify-center rounded-full bg-white">
          <Icon as={badge.icon} strokeWidth={4} className={cn('size-2.5', badge.className)} />
        </View>
      ) : null}
    </View>
  );
}
