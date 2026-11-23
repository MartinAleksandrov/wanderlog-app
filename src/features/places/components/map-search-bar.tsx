import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { DestinationResults } from '@/features/trips';
import type { DestinationSuggestion } from '@convex/googlePlaces';
import { SearchIcon, XIcon } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

type MapSearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (destination: DestinationSuggestion) => void;
  // A picked city is being located: the search icon turns into a spinner
  isBusy?: boolean;
};

// The search field floating at the top of the map. Typing a city shows Google's suggestions
// right below it; picking one is handled by the map (it flies there).
export function MapSearchBar({ value, onChangeText, onSelect, isBusy }: MapSearchBarProps) {
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
          placeholder="Search a city to explore"
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
      <DestinationResults query={value} onSelect={onSelect} className="border-t border-border" />
    </View>
  );
}
