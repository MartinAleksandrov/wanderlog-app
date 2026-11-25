import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { placeIcon } from '@/lib/place-icon';
import { placePhotoUrl } from '@/lib/place-photo-url';
import { cn } from '@/lib/utils';
import type { Coordinates, PlaceKind } from '@convex/schema';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, View } from 'react-native';
import { Marker } from 'react-native-maps';
import type { PinSize } from '../pin-layout';
import { PLACE_MODES, type PinLook } from '../place-modes';

const PHOTO_TIMEOUT_MS = 6000;

type PlacePinProps = {
  name: string;
  photoName?: string;
  // Google's place type: picks the icon when there's no photo
  category?: string;
  coordinates: Coordinates;
  // Which side of the app it belongs to: picks the colours (see place-modes.ts)
  kind: PlaceKind;
  // Saved to the trip (solid, with a check or heart) or only suggested (white label)
  isSaved: boolean;
  // The pin whose pop-up is open: drawn with a ring around it, on top of the others
  isSelected: boolean;
  // full = photo and name, compact = photo, mini = small dot (see pin-layout.ts)
  size: PinSize;
  onPress: () => void;
};

// A map pin: a rounded label with the place's photo (or an icon for its kind of place) and its
// name when there's room, on a pointed tail whose tip marks the spot. Where pins are crowded it's
// just a small dot on the spot. The selected pin gets a soft ring in its colour. Saved places
// carry a check (sights), a heart (sweet spots) or a bookmark (restaurants), so they stand out
// from suggestions even for someone who can't tell the colours apart.
//
// Android draws custom pins into a picture. While tracksViewChanges is on it redraws them all
// the time, which makes the map slow, so it's switched off once the pin looks final: the photo
// has loaded, or the pin (or the icon replacing a failed photo) has been laid out. Switching it
// off takes one last picture. The parent gives the pin a new `key` when its colour, size or
// selection changes, which mounts it again so the change gets drawn. The picture is cut at the
// pin's own bounds, which is why the tail is a real triangle (made from borders) instead of a
// rotated square that would stick out and get clipped.
export function PlacePin({
  name,
  photoName,
  category,
  coordinates,
  kind,
  isSaved,
  isSelected,
  size,
  onPress,
}: PlacePinProps) {
  const [photo, setPhoto] = useState<'loading' | 'loaded' | 'failed'>(
    photoName ? 'loading' : 'failed',
  );
  const [isLaidOut, setIsLaidOut] = useState(false);
  const showPhoto = size !== 'mini' && photoName !== undefined && photo !== 'failed';
  const isFinal = showPhoto ? photo === 'loaded' : isLaidOut;
  const mode = PLACE_MODES[kind];
  const look = mode.pins[isSaved ? 'saved' : 'suggested'];

  // No photo after all: draw again until the icon that replaces it has been laid out
  function giveUpPhoto() {
    setIsLaidOut(false);
    setPhoto('failed');
  }

  // A photo that hasn't arrived after a few seconds is given up on: the pin shows its icon and
  // stops redrawing. Android's image loader has no time limit, so a stalled download would
  // otherwise keep this pin redrawing (and the map slow) forever.
  useEffect(() => {
    if (!showPhoto || photo !== 'loading') return;
    const timer = setTimeout(() => {
      setIsLaidOut(false);
      setPhoto('failed');
    }, PHOTO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [showPhoto, photo]);

  return (
    <Marker
      coordinate={coordinates}
      // Full and compact pins stand on their tail's tip; a mini dot sits on the spot
      anchor={size === 'mini' ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 1 }}
      tracksViewChanges={!isFinal}
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
            <PinThumb
              look={look}
              badge={isSaved ? { icon: mode.savedIcon, className: mode.pinBadge } : undefined}
              category={category}
              photoName={showPhoto ? photoName : undefined}
              onPhotoLoad={() => setPhoto('loaded')}
              onPhotoError={giveUpPhoto}
              onIconLayout={() => setIsLaidOut(true)}
            />
          </PinLabel>
        )}
      </View>
    </Marker>
  );
}

// The rounded label (thumbnail, then the name when there's room) on its tail
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

// The round photo, or an icon for the kind of place, with a badge (check or heart) for a saved
// place. The photo must appear in full the moment it loads: Android fades images in over
// 300 ms, and the pin's last picture is taken right at onLoad, when the photo is still
// see-through. So it's React Native's Image with fadeDuration={0} (expo-image's fade can't be
// fully switched off).
function PinThumb({
  look,
  badge,
  category,
  photoName,
  onPhotoLoad,
  onPhotoError,
  onIconLayout,
}: {
  look: PinLook;
  badge?: { icon: LucideIcon; className: string };
  category?: string;
  // Undefined when the icon is shown instead
  photoName?: string;
  onPhotoLoad: () => void;
  onPhotoError: () => void;
  onIconLayout: () => void;
}) {
  return (
    <View className="size-8">
      {photoName ? (
        <Image
          source={{ uri: placePhotoUrl(photoName, 96) }}
          className="size-8 rounded-full bg-neutral-200"
          fadeDuration={0}
          onLoad={onPhotoLoad}
          onError={onPhotoError}
        />
      ) : (
        <View
          onLayout={onIconLayout}
          className={cn('size-8 items-center justify-center rounded-full', look.iconCircle)}
        >
          <Icon as={placeIcon(category)} className={cn('size-4', look.icon)} />
        </View>
      )}
      {badge ? (
        <View className="absolute -right-0.5 -bottom-0.5 size-3.5 items-center justify-center rounded-full bg-white">
          <Icon as={badge.icon} strokeWidth={4} className={cn('size-2.5', badge.className)} />
        </View>
      ) : null}
    </View>
  );
}
