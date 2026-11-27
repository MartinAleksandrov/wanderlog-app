import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { errorMessage } from '@/lib/error-message';
import { ExpandIcon, RotateCwIcon, SearchIcon, XIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';
import type { Region } from 'react-native-maps';
import { hasMovedAway, regionToArea } from '../map-area';
import type { SearchArea } from '../trip-places';

type MapStatusProps = {
  // "Trip to Porto", "Exploring Paris" or "“coffee”"
  title: string;
  // The area the orange pins were searched in, and what the map shows now
  searchedArea: SearchArea;
  region: Region | null;
  // "20 places" / "14 sweet spots" / "30 restaurants"
  countLabel: string;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onSearchArea: (area: SearchArea) => void;
  // Set when few places were found: "Search 10 km wide", which doubles the area
  wider?: { label: string; onPress: () => void };
  // Set while showing searched words' places: an ✕ in the pill goes back to the usual places
  onClose?: () => void;
};

// Under the map's search bar: what the map is showing and how many places, the
// "Search this area" button once the map has moved away from the searched area, a "search
// wider" button when a small town has few places, and a retry button when the search failed.
export function MapStatus({
  title,
  searchedArea,
  region,
  countLabel,
  isLoading,
  error,
  onRetry,
  onSearchArea,
  wider,
  onClose,
}: MapStatusProps) {
  const visibleArea = region ? regionToArea(region) : null;

  return (
    <View pointerEvents="box-none" className="items-center gap-2">
      <View className="flex-row items-center gap-2 rounded-full bg-background px-4 py-2 shadow-md">
        <Text className="shrink font-semibold" numberOfLines={1}>
          {title}
        </Text>
        {isLoading ? <ActivityIndicator size="small" /> : <Text variant="muted">{countLabel}</Text>}
        {onClose ? (
          <Pressable
            onPress={onClose}
            hitSlop={12}
            aria-label="Close search"
            className="-mr-1 rounded-full active:bg-accent"
          >
            <Icon as={XIcon} className="size-4 text-muted-foreground" />
          </Pressable>
        ) : null}
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
      ) : wider ? (
        <Button
          size="sm"
          variant="outline"
          className="rounded-full bg-background shadow-md"
          onPress={wider.onPress}
        >
          <Icon as={ExpandIcon} className="size-4" />
          <Text>{wider.label}</Text>
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
