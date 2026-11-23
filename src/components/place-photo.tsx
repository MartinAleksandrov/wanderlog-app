import { Icon } from '@/components/ui/icon';
import { placeIcon } from '@/lib/place-icon';
import { placePhotoUrl } from '@/lib/place-photo-url';
import { cn } from '@/lib/utils';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

type PlacePhotoProps = {
  photoName?: string;
  // Google's place type, e.g. "Castle": picks the icon shown when there's no photo
  category?: string;
  width: number;
  // Size and shape, e.g. "size-20 rounded-lg"
  className?: string;
  // Size of the fallback icon, e.g. "size-12" for a big cover
  iconClassName?: string;
};

// A place's photo. Without one (Google has none, or it fails to load) it shows an icon for the
// kind of place on a soft orange background instead of an empty box. expo-image caches photos
// on the device, so a photo seen once doesn't cost another Google request. (Map pins draw their
// own, see place-pin.tsx.)
export function PlacePhoto({
  photoName,
  category,
  width,
  className,
  iconClassName,
}: PlacePhotoProps) {
  // The name that failed to load, so a different photo gets a fresh try
  const [failedName, setFailedName] = useState<string | null>(null);
  const showPhoto = photoName !== undefined && photoName !== failedName;

  return (
    <View
      className={cn(
        'items-center justify-center overflow-hidden',
        showPhoto ? 'bg-muted' : 'bg-orange-100 dark:bg-orange-950',
        className,
      )}
    >
      {showPhoto ? (
        <Image
          source={{ uri: placePhotoUrl(photoName, width) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          onError={() => setFailedName(photoName)}
        />
      ) : (
        <Icon as={placeIcon(category)} className={cn('size-7 text-orange-500', iconClassName)} />
      )}
    </View>
  );
}
