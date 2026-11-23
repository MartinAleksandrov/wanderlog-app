import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { reportError } from '@/lib/error-reporting';
import type { ErrorBoundaryProps } from 'expo-router';
import { RotateCwIcon, TriangleAlertIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';

// Shown instead of a screen that crashed while rendering. Every route file exports it as
// `ErrorBoundary`; Expo Router then wraps that route in a React error boundary. So one broken
// screen doesn't take down the app: the tab bar keeps working, and "Try again" renders the
// screen afresh. Uses no app providers, so it also works if the root layout itself fails.
export function ScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // Report each error once, not on every render
  useEffect(() => {
    reportError(error, 'screen');
  }, [error]);

  return (
    <View className="flex-1 items-center justify-center gap-5 bg-background p-6">
      <View className="size-14 items-center justify-center rounded-full bg-destructive/10">
        <Icon as={TriangleAlertIcon} className="size-7 text-destructive" />
      </View>
      <View className="items-center gap-1">
        <Text className="text-lg font-semibold">Something went wrong</Text>
        <Text variant="muted" className="text-center">
          This screen ran into a problem. Try again, and if it keeps happening, restart the app.
        </Text>
      </View>
      {/* The technical message helps while developing; users never see it */}
      {__DEV__ ? (
        <Text className="w-full rounded-md bg-muted p-3 font-mono text-xs" numberOfLines={6}>
          {error.message}
        </Text>
      ) : null}
      <Button onPress={() => void retry()}>
        <Icon as={RotateCwIcon} />
        <Text>Try again</Text>
      </Button>
    </View>
  );
}
