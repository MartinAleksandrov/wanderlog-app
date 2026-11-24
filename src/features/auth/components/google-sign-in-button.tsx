import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useSSO } from '@clerk/expo';
import { Portal } from '@rn-primitives/portal';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { AppState, Image, Platform, View } from 'react-native';

import { errorMessage } from '../auth-errors';
import { SigningInScreen } from './signing-in-screen';

// Google's logo, hosted by Clerk (the same image Clerk's own sign-in UI uses)
const GOOGLE_LOGO = { uri: 'https://img.clerk.com/static/google.png?width=160' };

// Where Google (via Clerk) sends the user back when they're done in the browser.
// Our native build: wandr://sso-callback (the "scheme" in app.json).
// Expo Go: exp://<laptop IP>:8081/--/sso-callback, which changes with the laptop's Wi-Fi address.
// Clerk only finishes the sign-in for addresses on its allowlist (Clerk Dashboard → Native
// applications → Redirect URLs). Expo Router ignores this address: see src/app/+native-intent.tsx.
const REDIRECT_URL = AuthSession.makeRedirectUri({ path: 'sso-callback' });

// Android only: starts the browser (Chrome Custom Tabs) in the background while the sign-in
// screen is open, so it opens faster on tap. Released again when the screen goes away.
function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

// "Continue with Google": signs in, or creates an account on first use. Opens Google's sign-in
// page in the system browser (Google forbids in-app web views), then Clerk returns a finished
// session. Activating it is all we do: the root layout notices the session and shows the tabs.
// From the browser closing until the tabs, a "Signing you in…" screen covers the form.
export function GoogleSignInButton() {
  useWarmUpBrowser();
  const { startSSOFlow } = useSSO();
  const [busy, setBusy] = useState(false);
  // Back from Google's page while Clerk is still finishing: the cover is up
  const [returned, setReturned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google's page opens in the browser, which sends the app to the background. When the app is
  // active again during a sign-in, the browser has closed.
  useEffect(() => {
    if (!busy) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setReturned(true);
    });
    return () => subscription.remove();
  }, [busy]);

  // Also the cover's "Cancel": gives the form back even if a Clerk request hangs. A sign-in that
  // still finishes later is fine; the root layout then moves to the tabs as usual.
  function reset() {
    setBusy(false);
    setReturned(false);
  }

  async function onPress() {
    setBusy(true);
    setError(null);
    if (__DEV__) console.info('[auth] Google sign-in redirect URL:', REDIRECT_URL);

    // No `finally` below: the React Compiler can't handle it. `catch` takes every error, so the
    // reset() after the block always runs.
    try {
      const { createdSessionId, setActive, authSessionResult } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: REDIRECT_URL,
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      } else if (authSessionResult?.type === 'success') {
        // Closing the browser or pressing back (type 'cancel'/'dismiss') is a normal choice, not an error
        setError('Google sign-in could not be completed. Please try again.');
      }
    } catch (caught) {
      setError(errorMessage(caught instanceof Error ? caught : null));
    }
    reset();
  }

  return (
    <View className="gap-2">
      <Button variant="outline" onPress={() => void onPress()} disabled={busy}>
        <Image source={GOOGLE_LOGO} className="size-4" accessibilityIgnoresInvertColors />
        <Text>Continue with Google</Text>
      </Button>
      {error ? <Text className="text-center text-sm text-destructive">{error}</Text> : null}
      {/* After Google's page closes, Clerk still needs a few requests before the session is
          active. Cover the form meanwhile (the root layout's cover takes over from there).
          A Portal draws it at the root (PortalHost in src/app/_layout.tsx), so it fills the
          screen, not the card. */}
      {returned ? (
        <Portal name="google-sign-in">
          <SigningInScreen
            slowAction={
              <Button variant="outline" onPress={reset}>
                <Text>Cancel</Text>
              </Button>
            }
          />
        </Portal>
      ) : null}
    </View>
  );
}
