import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { PortalHost } from '@rn-primitives/portal';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { Stack } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { useUniwind } from 'uniwind';

const convex = new ConvexReactClient('https://notable-sockeye-345.eu-west-1.convex.cloud');

export {
  // Shows an error screen instead of crashing if any screen throws while rendering
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  // 'light' or 'dark', following the phone's setting
  const { theme } = useUniwind();

  return (
    <ConvexProvider client={convex}>
      <ThemeProvider value={NAV_THEME[theme ?? 'light']}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }} />
        <PortalHost />
      </ThemeProvider>
    </ConvexProvider>
  );
}
