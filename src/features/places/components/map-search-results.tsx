import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { errorMessage } from '@/lib/error-message';
import { placeIcon } from '@/lib/place-icon';
import { api } from '@convex/_generated/api';
import type {
  DestinationSuggestion,
  MapSearchSuggestion,
  PlaceSuggestion,
} from '@convex/googlePlaces';
import { skipToken, useQuery as useCachedQuery } from '@tanstack/react-query';
import { useAction } from 'convex/react';
import { Building2Icon, MapPinIcon, SearchIcon, type LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useDebounce } from 'use-debounce';
import type { SearchArea } from '../trip-places';

type MapSearchResultsProps = {
  // What the user has typed so far
  query: string;
  // What the map shows, so the places near it come first
  near: SearchArea;
  onSelectCity: (city: DestinationSuggestion) => void;
  onSelectPlace: (place: PlaceSuggestion) => void;
  // "Search “coffee” in this area": every match as a pin
  onSearchText: (query: string) => void;
  className?: string;
};

// Under the map's search bar: first a row that searches the typed words in the area the map
// shows, then Google's suggestions for them, cities and single places mixed, nearest first.
// Shows nothing below 2 letters.
export function MapSearchResults({
  query,
  near,
  onSelectCity,
  onSelectPlace,
  onSearchText,
  className,
}: MapSearchResultsProps) {
  const searchMap = useAction(api.googlePlaces.searchMap);
  const typed = query.trim();
  // Search 350 ms after the user stops typing, not on every key: each search is a paid request
  const [debouncedQuery] = useDebounce(typed, 350);
  const { center, widthMeters, heightMeters } = near;

  // Cached per text and map area (typing back to "Lis" is free), and late answers for text the
  // user has already changed are ignored
  const suggestions = useCachedQuery({
    queryKey: [
      'map-search',
      debouncedQuery,
      center.latitude,
      center.longitude,
      widthMeters,
      heightMeters,
    ],
    queryFn:
      debouncedQuery.length >= 2
        ? () => searchMap({ query: debouncedQuery, near: { center, widthMeters, heightMeters } })
        : skipToken,
    staleTime: Infinity,
  });

  if (typed.length < 2) return null;

  return (
    <View className={className}>
      <ResultRow
        icon={SearchIcon}
        title={`Search “${typed}” in this area`}
        subtitle="Show every match on the map"
        onPress={() => onSearchText(typed)}
      />
      {suggestions.isFetching ? <ActivityIndicator className="self-start p-3" /> : null}
      {suggestions.error ? (
        <Text className="p-3 text-sm text-destructive">{errorMessage(suggestions.error)}</Text>
      ) : null}
      {suggestions.data?.length === 0 ? (
        <Text variant="muted" className="p-3">
          No cities or places match “{debouncedQuery}”.
        </Text>
      ) : null}
      {suggestions.data?.map((suggestion) => (
        <ResultRow
          key={suggestion.placeId}
          icon={iconOf(suggestion)}
          title={suggestion.name}
          subtitle={suggestion.type === 'city' ? suggestion.region : suggestion.address}
          onPress={() =>
            suggestion.type === 'city' ? onSelectCity(suggestion) : onSelectPlace(suggestion)
          }
        />
      ))}
    </View>
  );
}

// A city gets a skyline, an address a plain pin, any other place its kind's icon (a cup for a
// café, a fork and knife for a restaurant…), as in the places list
function iconOf(suggestion: MapSearchSuggestion): LucideIcon {
  if (suggestion.type === 'city') return Building2Icon;
  return suggestion.typeWords ? placeIcon(suggestion.typeWords) : MapPinIcon;
}

function ResultRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 px-3 py-3 active:bg-accent">
      <Icon as={icon} className="text-muted-foreground" />
      <View className="flex-1">
        <Text numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text variant="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
