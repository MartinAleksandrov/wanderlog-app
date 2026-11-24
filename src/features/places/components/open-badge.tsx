import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { View } from 'react-native';
import type { OpenStatus } from '../open-status';

// Google Maps' colours: green open, amber closing soon, red closed
const DOT: Record<OpenStatus['tone'], string> = {
  open: 'bg-green-600',
  closing: 'bg-amber-500',
  closed: 'bg-red-600',
};
const TEXT: Record<OpenStatus['tone'], string> = {
  open: 'text-green-700 dark:text-green-400',
  closing: 'text-amber-700 dark:text-amber-400',
  closed: 'text-red-700 dark:text-red-400',
};

// "● Open · closes 18:00" on the places list, the map's pop-up and the details sheet
export function OpenBadge({ status }: { status: OpenStatus }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={cn('size-2 rounded-full', DOT[status.tone])} />
      <Text className={cn('text-sm font-medium', TEXT[status.tone])} numberOfLines={1}>
        {status.label}
      </Text>
    </View>
  );
}
