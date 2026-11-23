import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { errorMessage } from '@/lib/error-message';
import { RotateCwIcon, SearchIcon } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';
import type { Region } from 'react-native-maps';
import { hasMovedAway, regionToArea } from '../map-area';
import type { SearchArea } from '../trip-places';

type MapStatusProps = {
  // "Trip to Porto" or "Exploring Paris"
  title: string;
  // The area the orange pins were searched in, and what the map shows now
  searchedArea: SearchArea;
  region: Region | null;
  placeCount: number;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onSearchArea: (area: SearchArea) => void;
};

// Under the map's search bar: what the map is showing and how many places, the
// "Search this area" button once the map has moved away from the searched area, and a retry
// button when the search failed.
export function MapStatus({
  title,
  searchedArea,
  region,
  placeCount,
  isLoading,
  error,
  onRetry,
  onSearchArea,
}: MapStatusProps) {
  const visibleArea = region ? regionToArea(region) : null;

  return (
    <View pointerEvents="box-none" className="items-center gap-2">
      <View className="flex-row items-center gap-2 rounded-full bg-background px-4 py-2 shadow-md">
        <Text className="font-semibold" numberOfLines={1}>
          {title}
        </Text>
        {isLoading ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text variant="muted">{placeCount} places</Text>
        )}
      </View>
      {visibleArea && !isLoading && hasMovedAway(searchedArea, visibleArea) ? (
        <Button
          size="sm"
          className="rounded-full shadow-md"
          onPress={() => onSearchArea(visibleArea)}
        >
          <Icon as={SearchIcon} className="size-4" />
          <Text>Search this area</Text>
        </Button>
      ) : null}
      {error ? (
        <Button size="sm" variant="outline" className="rounded-full" onPress={onRetry}>
          <Icon as={RotateCwIcon} className="size-4" />
          <Text className="shrink" numberOfLines={2}>
            {errorMessage(error)}
          </Text>
        </Button>
      ) : null}
    </View>
  );
}
