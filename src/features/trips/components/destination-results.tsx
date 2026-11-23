import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { errorMessage } from '@/lib/error-message';
import { api } from '@convex/_generated/api';
import type { DestinationSuggestion } from '@convex/googlePlaces';
import { skipToken, useQuery as useCachedQuery } from '@tanstack/react-query';
import { useAction } from 'convex/react';
import { MapPinIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useDebounce } from 'use-debounce';

type DestinationResultsProps = {
  // What the user has typed so far
  query: string;
  onSelect: (destination: DestinationSuggestion) => void;
  className?: string;
};

// Google's city suggestions for what's typed so far, as a list to tap. Shared by the
// "Choose your next trip" pop-up and the map's search bar. Shows nothing below 2 letters.
export function DestinationResults({ query, onSelect, className }: DestinationResultsProps) {
  const searchDestinations = useAction(api.googlePlaces.searchDestinations);
  // Search 350 ms after the user stops typing, not on every key: each search is a paid request
  const [debouncedQuery] = useDebounce(query.trim(), 350);

  // TanStack Query runs the search, keeps results per text (typing back to "Lis" is free), and
  // ignores late answers for text the user has already changed
  const suggestions = useCachedQuery({
    queryKey: ['destinations', debouncedQuery],
    queryFn:
      debouncedQuery.length >= 2 ? () => searchDestinations({ query: debouncedQuery }) : skipToken,
    staleTime: Infinity,
  });

  if (query.trim().length < 2) return null;

  return (
    <View className={className}>
      {suggestions.isFetching ? <ActivityIndicator className="self-start p-3" /> : null}
      {suggestions.error ? (
        <Text className="p-3 text-sm text-destructive">{errorMessage(suggestions.error)}</Text>
      ) : null}
      {suggestions.data?.length === 0 ? (
        <Text variant="muted" className="p-3">
          No cities match “{debouncedQuery}”.
        </Text>
      ) : null}
      {suggestions.data?.map((suggestion) => (
        <Pressable
          key={suggestion.placeId}
          onPress={() => onSelect(suggestion)}
          className="flex-row items-center gap-3 px-3 py-3 active:bg-accent"
        >
          <Icon as={MapPinIcon} className="text-muted-foreground" />
          <View className="flex-1">
            <Text>{suggestion.name}</Text>
            {suggestion.region ? <Text variant="muted">{suggestion.region}</Text> : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
