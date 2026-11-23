import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useRouter } from 'expo-router';
import { PlaneTakeoffIcon, PlusIcon } from 'lucide-react-native';
import { View } from 'react-native';

// Shown wherever a trip is needed but the user has none yet (home, map, places). The button
// opens the "Choose your next trip" pop-up (src/app/new-trip.tsx).
export function NoTripState({ message }: { message: string }) {
  const router = useRouter();

  return (
    <View className="items-center gap-4 rounded-xl border border-dashed border-border p-6">
      <Icon as={PlaneTakeoffIcon} className="size-8 text-muted-foreground" />
      <View className="items-center gap-1">
        <Text className="text-lg font-semibold">No trip yet</Text>
        <Text variant="muted" className="text-center">
          {message}
        </Text>
      </View>
      <Button onPress={() => router.push('/new-trip')}>
        <Icon as={PlusIcon} />
        <Text>Choose your next trip</Text>
      </Button>
    </View>
  );
}
