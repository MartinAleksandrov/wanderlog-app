import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { LocateFixedIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

// "See how far each place is from you · Turn on", at the top of the places list while the app
// may still ask for the location. Tapping shows the system's permission dialog. After a second
// "no" Android stops asking, and so does this row (see my-location.tsx).
export function LocationPrompt({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-3 active:bg-accent"
    >
      <Icon as={LocateFixedIcon} className="size-5 text-blue-600" />
      <Text className="flex-1 text-sm">See how far each place is from you</Text>
      <Text className="text-sm font-semibold text-blue-600">Turn on</Text>
    </Pressable>
  );
}
