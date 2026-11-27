import { Text } from '@/components/ui/text';
import type { ReactNode } from 'react';
import { View } from 'react-native';

// A titled block of the admin screens: a heading, an optional line explaining the numbers, and
// the cards under them
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text variant="h3">{title}</Text>
        {description ? <Text variant="muted">{description}</Text> : null}
      </View>
      {children}
    </View>
  );
}
