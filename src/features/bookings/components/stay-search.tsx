import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { errorMessage, showError } from '@/lib/error-message';
import { api } from '@convex/_generated/api';
import type { StaySuggestion } from '@convex/googlePlaces';
import { BOOKING_TEXT_MAX_LENGTH } from '@convex/lib/limits';
import type { Coordinates } from '@convex/schema';
import { skipToken, useQuery as useCachedQuery } from '@tanstack/react-query';
import { useAction } from 'convex/react';
import { BedDoubleIcon, MapPinIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useDebounce } from 'use-debounce';
import type { BookingDraft } from '../booking-draft';

type StayFields = Pick<
  BookingDraft,
  'name' | 'address' | 'coordinates' | 'providerPlaceId' | 'phone' | 'website'
>;

type StaySearchProps = {
  value: StayFields;
  // The trip's destination: hotels near it come first
  near?: Coordinates;
  onChange: (fields: Partial<StayFields>) => void;
};

// Where you're staying. Typing searches Google for hotels and addresses near the trip; picking one
// fills in the address, map position, phone and website. Typing a name without picking works too
// (a friend's flat), with the address typed by hand.
export function StaySearch({ value, near, onChange }: StaySearchProps) {
  const stayDetails = useAction(api.googlePlaces.stayDetails);
  const [isPicking, setIsPicking] = useState(false);

  // A picked place keeps everything Google said about it. A promise chain, not try/finally:
  // React Compiler can't compile a `finally` block yet.
  function pick(suggestion: StaySuggestion) {
    setIsPicking(true);
    stayDetails({ placeId: suggestion.placeId })
      .then((details) =>
        onChange({
          name: suggestion.name,
          providerPlaceId: suggestion.placeId,
          address: details.address ?? suggestion.address,
          coordinates: details.coordinates,
          phone: details.phone ?? '',
          website: details.website ?? '',
        }),
      )
      .catch((error: unknown) => showError("Couldn't load this place", error))
      .finally(() => setIsPicking(false));
  }

  if (value.providerPlaceId !== undefined) {
    return (
      <View className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-3">
        <Icon as={BedDoubleIcon} className="text-indigo-600 dark:text-indigo-300" />
        <View className="flex-1">
          <Text className="font-semibold">{value.name}</Text>
          {value.address ? <Text variant="muted">{value.address}</Text> : null}
        </View>
        <Button
          variant="ghost"
          size="sm"
          onPress={() =>
            onChange({
              name: '',
              address: '',
              coordinates: undefined,
              providerPlaceId: undefined,
              phone: '',
              website: '',
            })
          }
        >
          <Text>Change</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="gap-2">
      <Input
        placeholder="Hotel name or address"
        value={value.name}
        onChangeText={(name) => onChange({ name })}
        maxLength={BOOKING_TEXT_MAX_LENGTH}
        autoCorrect={false}
        returnKeyType="search"
      />
      {isPicking ? (
        <ActivityIndicator className="self-start p-3" />
      ) : (
        <StayResults query={value.name} near={near} onSelect={pick} />
      )}
    </View>
  );
}

// Google's matches for what's typed so far. Shows nothing below 3 letters.
function StayResults({
  query,
  near,
  onSelect,
}: {
  query: string;
  near?: Coordinates;
  onSelect: (suggestion: StaySuggestion) => void;
}) {
  const searchStays = useAction(api.googlePlaces.searchStays);
  // Search 350 ms after the user stops typing, not on every key: each search is a paid request
  const [debounced] = useDebounce(query.trim(), 350);

  // Cached per text and place, like the city search (see DestinationResults)
  const results = useCachedQuery({
    queryKey: ['stays', debounced, near?.latitude, near?.longitude],
    queryFn: debounced.length >= 3 ? () => searchStays({ query: debounced, near }) : skipToken,
    staleTime: Infinity,
  });

  if (query.trim().length < 3) return null;

  return (
    <View className="-mx-1">
      {results.isFetching ? <ActivityIndicator className="self-start p-3" /> : null}
      {results.error ? (
        <Text className="p-3 text-sm text-destructive">{errorMessage(results.error)}</Text>
      ) : null}
      {results.data?.map((suggestion) => (
        <Pressable
          key={suggestion.placeId}
          onPress={() => onSelect(suggestion)}
          className="flex-row items-center gap-3 px-3 py-2.5 active:bg-accent"
        >
          <Icon as={MapPinIcon} className="text-muted-foreground" />
          <View className="flex-1">
            <Text>{suggestion.name}</Text>
            {suggestion.address ? <Text variant="muted">{suggestion.address}</Text> : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
