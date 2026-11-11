import '@/global.css';

import { env } from '@/lib/env';
import { NAV_THEME } from '@/lib/theme';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { PortalHost } from '@rn-primitives/portal';
import { ConvexReactClient, useConvexAuth } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { Stack } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useUniwind } from 'uniwind';

const convex = new ConvexReactClient(env.convexUrl);

// Keep the splash screen up until we know whether the user is signed in,
// so the app doesn't flash the sign-in screen at someone who's already logged in.
void SplashScreen.preventAutoHideAsync();

export {
  // Shows an error screen instead of crashing if any screen throws while rendering
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  // 'light' or 'dark', following the phone's setting
  const { theme } = useUniwind();

  return (
    // 1. Clerk: who the user is. Keeps the session (stored encrypted on the device by tokenCache).
    <ClerkProvider publishableKey={env.clerkPublishableKey} tokenCache={tokenCache}>
      {/* 2. Convex: our backend. Asks Clerk for a fresh token and sends it with every request.
          Passing the useAuth hook itself (not calling it) is Convex's official Clerk API: the
          provider calls it internally. React Doctor flags any hook passed as a value, so this
          one line is exempted on purpose. */}
      {/* react-doctor-disable-next-line react-hooks-js/hooks */}
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ThemeProvider value={NAV_THEME[theme ?? 'light']}>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          <RootNavigator />
          <PortalHost />
        </ThemeProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

// Decides which part of the app exists right now, based on whether Convex has accepted the
// user's Clerk token (useConvexAuth). Signed in: the tabs. Signed out: the sign-in/sign-up screens.
// When the state changes (sign in, sign out), the guards flip and Expo Router moves the user.
function RootNavigator() {
  const { isLoading, isAuthenticated } = useConvexAuth();

  useEffect(() => {
    if (!isLoading) void SplashScreen.hideAsync();
  }, [isLoading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
