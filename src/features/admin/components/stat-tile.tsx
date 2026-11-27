import { Text } from '@/components/ui/text';
import { View } from 'react-native';

// One headline number on the dashboard: a label, the number, and an optional line under it.
// Tiles sit two or three to a row (flex-1 shares the row's width).
export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View
      className="flex-1 gap-1 rounded-xl border border-border bg-card p-4"
      accessible
      accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}
    >
      <Text variant="muted">{label}</Text>
      <Text className="text-3xl font-semibold">{value}</Text>
      {hint ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}
