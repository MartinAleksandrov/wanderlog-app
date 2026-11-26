import '@/global.css';

import { SignOutButton, SigningInScreen } from '@/features/auth';
import { env } from '@/lib/env';
import { installGlobalErrorHandler, reportError } from '@/lib/error-reporting';
import { NAV_THEME } from '@/lib/theme';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { api } from '@convex/_generated/api';
import { PortalHost } from '@rn-primitives/portal';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConvexReactClient, useConvexAuth, useMutation } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexError } from 'convex/values';
import { Stack } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useUniwind } from 'uniwind';

// First thing: errors outside rendering (button handlers, timers, forgotten promises) get
// reported from here on. Errors while rendering are caught by the screens' error boundaries.
installGlobalErrorHandler();

// One Convex client per app run. Hot reload (development) runs this file again on every save;
// a new client each time left the old connections running (a reconnect loop) and briefly
// showed a signed-in user the sign-in screen. Reusing the client avoids both.
const globals = globalThis as typeof globalThis & { __convexClient?: ConvexReactClient };
// (Dropped connections aren't reported: Android closes the socket whenever the app goes to the
// background, and Convex reconnects by itself.)
const convex = (globals.__convexClient ??= new ConvexReactClient(env.convexUrl));

// Cache for one-off requests that aren't live Convex queries: the Google Places searches
// (Convex actions). Convex queries keep themselves up to date and don't go through it.
// Retries: an error our backend throws on purpose (ConvexError, e.g. "not set up") won't change
// on a retry, so show it at once; anything else (a network blip) gets one more try, since every
// Google request is paid.
const queryClient = new QueryClient({
  // Screens show search errors themselves; unexpected ones are also reported
  queryCache: new QueryCache({
    onError: (error) => {
      if (!(error instanceof ConvexError)) reportError(error, 'query');
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => !(error instanceof ConvexError) && failureCount < 1,
    },
  },
});

// Development only. This React Native version no longer shows warnings in the app: they print
// in the Metro terminal (and React Native DevTools). What's left in the app is a one-off
// "Open debugger to view warnings" toast, which Clerk's development-keys notice triggered on
// every start; it covered the tab bar and blocked taps. Both are hidden here. Warnings still
// print in the terminal, and errors still show as red toasts.
LogBox.ignoreLogs([
  'Clerk: Clerk has been loaded with development keys',
  'Open debugger to view warnings',
]);

// Keep the splash screen up until we know whether the user is signed in,
// so the app doesn't flash the sign-in screen at someone who's already logged in.
void SplashScreen.preventAutoHideAsync();

// The last line of defence: an error while rendering the providers or navigation itself shows
// the same "Something went wrong / Try again" screen instead of a blank app
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/screen-error-boundary';

export default function RootLayout() {
  // 'light' or 'dark', following the phone's setting
  const { theme } = useUniwind();

  return (
    // 0. Gesture Handler's root: a native view that sees every touch before React Native does,
    //    so gestures (swiping between sides in the places tab) can be told apart from scrolling.
    //    Gestures anywhere below it work; without it they're never recognised.
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* 1. Clerk: who the user is. Keeps the session (stored encrypted on the device by
        tokenCache). */}
      <ClerkProvider publishableKey={env.clerkPublishableKey} tokenCache={tokenCache}>
        {/* 2. Convex: our backend. Asks Clerk for a fresh token and sends it with every request.
          Passing the useAuth hook itself (not calling it) is Convex's official Clerk API: the
          provider calls it internally. React Doctor flags any hook passed as a value, so this
          one line is exempted on purpose. */}
        {/* react-doctor-disable-next-line react-hooks-js/hooks */}
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider value={NAV_THEME[theme ?? 'light']}>
              <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
              <RootNavigator />
              <PortalHost />
            </ThemeProvider>
          </QueryClientProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}

// Decides which part of the app exists right now, based on whether Convex has accepted the
// user's Clerk token (useConvexAuth). Signed in: the tabs. Signed out: the sign-in/sign-up screens.
// When the state changes (sign in, sign out), the guards flip and Expo Router moves the user.
// redirectTo says where a blocked route sends the user. Without it Expo Router (SDK 58+) goes to
// the navigator's anchor, "/", which is itself blocked when signed out: an "Unmatched Route" screen.
function RootNavigator() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  // Clerk's own answer comes first: true as soon as a sign-in finishes on the device
  const { isSignedIn } = useAuth();
  const storeUser = useMutation(api.users.store);

  // Has Convex accepted this user's token since the app started? Reset on sign-out. Updated while
  // rendering: React's pattern for state that follows other values (no extra render, unlike an effect).
  const [hadConvexAuth, setHadConvexAuth] = useState(false);
  if (isAuthenticated && !hadConvexAuth) setHadConvexAuth(true);
  if (isSignedIn === false && hadConvexAuth) setHadConvexAuth(false);

  // Signed in with Clerk, but Convex hasn't accepted the token yet (a fetch from Clerk and a
  // check by the Convex server). The guards below still show the sign-in form during that second,
  // so it's covered. On app start the splash screen sits on top of this state anyway.
  // Only before the first acceptance: if Convex drops the token later (offline for a few minutes,
  // so the token refresh failed), the user didn't just sign in, and the guards handle it as before.
  const finishingSignIn = isSignedIn === true && !isAuthenticated && !hadConvexAuth;

  useEffect(() => {
    if (!isLoading) void SplashScreen.hideAsync();
  }, [isLoading]);

  // After every sign-in, make sure the backend has this person's users row, so trips can point
  // to it. Mutations create the row too if it's missing, so a failure here isn't fatal.
  useEffect(() => {
    if (isAuthenticated) {
      storeUser().catch((error: unknown) => reportError(error, 'action'));
    }
  }, [isAuthenticated, storeUser]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isAuthenticated} redirectTo="/sign-in">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="new-trip"
            options={{ presentation: 'modal', headerShown: true, title: 'Choose your next trip' }}
          />
          <Stack.Screen
            name="edit-trip/[tripId]"
            options={{ presentation: 'modal', headerShown: true, title: 'Edit trip' }}
          />
          {/* A full screen with a back arrow: the bookings are read, not just glanced at */}
          <Stack.Screen
            name="trip/[tripId]/bookings"
            options={{ headerShown: true, title: 'Bookings' }}
          />
          {/* The form sets its own title ("Add a stay", "Edit flight") */}
          <Stack.Screen
            name="trip/[tripId]/booking"
            options={{ presentation: 'modal', headerShown: true, title: 'Booking' }}
          />
          {/* Slides up from the bottom: 60% of the screen first, drag up for the full height.
            Sheets have no header; the screen draws its own title. */}
          <Stack.Screen
            name="place/[placeId]"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.6, 1],
              sheetGrabberVisible: true,
              sheetCornerRadius: 24,
            }}
          />
          {/* The plan's "Add places" list, the same kind of sheet */}
          <Stack.Screen
            name="add-stops"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.6, 1],
              sheetGrabberVisible: true,
              sheetCornerRadius: 24,
            }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!isAuthenticated} redirectTo="/">
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      {/* Drawn over the navigator rather than instead of it: Expo Router needs the Stack mounted */}
      {/* Sign out: if Convex never accepts the token (a broken Clerk JWT template, say), Clerk
          stays signed in, and signing out is the only way back to a working sign-in form */}
      {finishingSignIn ? <SigningInScreen slowAction={<SignOutButton />} /> : null}
    </>
  );
}
