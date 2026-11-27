import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import type { DestinationSuggestion, PlaceSuggestion } from '@convex/googlePlaces';
import { SearchIcon, XIcon } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';
import type { SearchArea } from '../trip-places';
import { MapSearchResults } from './map-search-results';

type MapSearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  // What the map shows: nearby places come first, and words are searched there
  near: SearchArea;
  onSelectCity: (city: DestinationSuggestion) => void;
  onSelectPlace: (place: PlaceSuggestion) => void;
  onSearchText: (query: string) => void;
  // A picked city or place is being located, or words searched: the search icon turns into a
  // spinner
  isBusy?: boolean;
};

// The search field floating at the top of the map. Typing shows Google's suggestions right
// below it, cities and single places (a café, a museum), plus a row to search the words in the
// area the map shows; the keyboard's search key does the same. What each one does is up to the
// map (map-screen.tsx).
export function MapSearchBar({
  value,
  onChangeText,
  near,
  onSelectCity,
  onSelectPlace,
  onSearchText,
  isBusy,
}: MapSearchBarProps) {
  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-background shadow-md">
      <View className="flex-row items-center gap-1 pr-1 pl-3">
        {isBusy ? (
          <ActivityIndicator size="small" />
        ) : (
          <Icon as={SearchIcon} className="size-5 text-muted-foreground" />
        )}
        <Input
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={() => {
            if (value.trim().length >= 2) onSearchText(value.trim());
          }}
          placeholder="Search a city, café or place"
          autoCorrect={false}
          returnKeyType="search"
          className="h-12 w-auto min-w-0 flex-1 border-0 bg-transparent shadow-none dark:bg-transparent"
        />
        {value ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear search"
            onPress={() => onChangeText('')}
          >
            <Icon as={XIcon} className="text-muted-foreground" />
          </Button>
        ) : null}
      </View>
      <MapSearchResults
        query={value}
        near={near}
        onSelectCity={onSelectCity}
        onSelectPlace={onSelectPlace}
        onSearchText={onSearchText}
        className="border-t border-border"
      />
    </View>
  );
}
