import { PlacePhoto } from '@/components/place-photo';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PlaneTakeoffIcon, XIcon } from 'lucide-react-native';
import { View } from 'react-native';

type ExploreCardProps = {
  name: string;
  region: string;
  photoName?: string;
  onPlanTrip: () => void;
  onClose: () => void;
};

// Shown under the map's search bar while exploring a city found with it: the city, a button to
// make it the next trip, and a close button that goes back to the current trip. One compact row
// at the top, so the map keeps its full height and Google's logo stays visible at the bottom.
export function ExploreCard({ name, region, photoName, onPlanTrip, onClose }: ExploreCardProps) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-background p-2 shadow-md">
      <PlacePhoto photoName={photoName} width={160} className="size-12 rounded-xl" />
      <View className="flex-1">
        <Text className="font-semibold" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="muted" numberOfLines={1}>
          {region || 'Places to visit'}
        </Text>
      </View>
      <Button size="sm" onPress={onPlanTrip}>
        <Icon as={PlaneTakeoffIcon} className="size-4" />
        <Text>Plan trip</Text>
      </Button>
      <Button variant="ghost" size="icon" aria-label="Stop exploring" onPress={onClose}>
        <Icon as={XIcon} className="text-muted-foreground" />
      </Button>
    </View>
  );
}
