import { PlacePhoto } from '@/components/place-photo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { openLink } from '@/lib/open-link';
import { cn } from '@/lib/utils';
import type { PlaceDetails, PlaceReview } from '@convex/googlePlaces';
import { ClockIcon, GlobeIcon, MapPinIcon, PhoneIcon, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { FlatList, Pressable, useWindowDimensions, View } from 'react-native';

// The pieces of the place pop-up (place-details-sheet.tsx)

// The place's photos side by side; swipe for more. The list only loads photos near the screen,
// so photos nobody swipes to aren't requested (each one is a paid Google request).
export function PhotoStrip({ photoNames, category }: { photoNames: string[]; category?: string }) {
  const { width } = useWindowDimensions();
  // One photo fills the width (minus the sheet's 20 dp padding); several peek at the next one
  const photoWidth = photoNames.length > 1 ? width * 0.75 : width - 40;

  if (photoNames.length === 0) {
    return (
      <PlacePhoto
        category={category}
        width={800}
        className="h-48 w-full rounded-2xl"
        iconClassName="size-14"
      />
    );
  }
  return (
    <FlatList
      horizontal
      data={photoNames}
      keyExtractor={(name) => name}
      showsHorizontalScrollIndicator={false}
      initialNumToRender={2}
      windowSize={3}
      contentContainerClassName="gap-2"
      renderItem={({ item }) => (
        <View style={{ width: photoWidth }}>
          <PlacePhoto
            photoName={item}
            category={category}
            width={900}
            className="h-52 w-full rounded-2xl"
          />
        </View>
      )}
    />
  );
}

// "Market · ★ 4.5 (32,789) · Open now"
export function PlaceSummaryLine({ place }: { place: PlaceDetails }) {
  return (
    <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
      {place.category ? <Text variant="muted">{place.category}</Text> : null}
      {place.rating ? (
        <Text className="text-sm font-medium">
          {/* The same solid star as the places list and the reviews */}
          <Text className="text-sm text-orange-500">★</Text> {place.rating}
          {place.ratingCount ? (
            <Text variant="muted"> ({place.ratingCount.toLocaleString()})</Text>
          ) : null}
        </Text>
      ) : null}
      {place.openNow === undefined ? null : (
        <Text
          className={cn(
            'text-sm font-semibold',
            place.openNow ? 'text-green-600' : 'text-destructive',
          )}
        >
          {place.openNow ? 'Open now' : 'Closed now'}
        </Text>
      )}
    </View>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Text className="text-sm font-semibold text-muted-foreground uppercase">{title}</Text>
      {children}
    </View>
  );
}

// Address, hours, website and phone. Rows with a link open it when tapped.
export function PlaceFacts({ place }: { place: PlaceDetails }) {
  return (
    <Section title="Details">
      {place.address ? (
        <InfoRow icon={MapPinIcon}>
          <Text>{place.address}</Text>
        </InfoRow>
      ) : null}
      {place.openingHours ? (
        <InfoRow icon={ClockIcon}>
          <OpeningHours lines={place.openingHours} />
        </InfoRow>
      ) : null}
      {place.website ? (
        <InfoRow icon={GlobeIcon} onPress={() => openLink(place.website ?? '')}>
          <Text className="text-blue-600 underline" numberOfLines={1}>
            {siteName(place.website)}
          </Text>
        </InfoRow>
      ) : null}
      {place.phone ? (
        <InfoRow
          icon={PhoneIcon}
          onPress={() => openLink(`tel:${(place.phone ?? '').replace(/\s/g, '')}`)}
        >
          <Text className="text-blue-600">{place.phone}</Text>
        </InfoRow>
      ) : null}
    </Section>
  );
}

function InfoRow({
  icon,
  onPress,
  children,
}: {
  icon: LucideIcon;
  onPress?: () => void;
  children: ReactNode;
}) {
  const row = (
    <View className="flex-row items-start gap-3">
      <Icon as={icon} className="mt-0.5 size-5 text-muted-foreground" />
      <View className="flex-1">{children}</View>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} className="active:opacity-60">
      {row}
    </Pressable>
  ) : (
    row
  );
}

// "www.example.com/visit?lang=en" -> "example.com"
function siteName(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '');
}

// Google lists the week from Monday; JavaScript counts days from Sunday
function mondayFirstWeekday(): number {
  return (new Date().getDay() + 6) % 7;
}

// This week's opening hours, today in bold
function OpeningHours({ lines }: { lines: string[] }) {
  const today = mondayFirstWeekday();
  return (
    <View className="gap-0.5">
      {lines.map((line, day) => (
        <Text
          key={line}
          className={cn('text-sm', day === today ? 'font-semibold' : 'text-muted-foreground')}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

// Google's reviews, each with its author's name (Google requires showing it)
export function ReviewList({ reviews }: { reviews: PlaceReview[] }) {
  return (
    <View className="gap-3">
      {reviews.map((review) => (
        <View
          key={`${review.author}-${review.when}-${review.text.slice(0, 24)}`}
          className="gap-1 rounded-xl border border-border p-3"
        >
          <View className="flex-row items-center justify-between gap-2">
            <Text className="shrink font-semibold" numberOfLines={1}>
              {review.author}
            </Text>
            {review.rating ? (
              <Text className="text-sm text-orange-500">
                {'★'.repeat(Math.round(review.rating))}
              </Text>
            ) : null}
          </View>
          {review.when ? (
            <Text className="text-xs text-muted-foreground">{review.when}</Text>
          ) : null}
          <Text className="text-sm leading-5">{review.text}</Text>
        </View>
      ))}
    </View>
  );
}
