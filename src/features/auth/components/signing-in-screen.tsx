import { Text } from '@/components/ui/text';
import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, View } from 'react-native';

// A normal sign-in finishes in about a second. After this long, something is wrong.
const SLOW_AFTER_MS = 10_000;

// Covers the whole app while a sign-in that already worked is being finished: Clerk creating the
// session, then Convex checking Clerk's token. Those are a few network round trips (about a
// second). Without this cover the sign-in form stayed visible meanwhile, as if nothing happened.
//
// slowAction: the way out, shown after 10 seconds (a network request can hang forever, since
// fetch has no timeout). The Google button passes "Cancel", the root layout "Sign out".
export function SigningInScreen({ slowAction }: { slowAction: ReactNode }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    // The password form's keyboard would otherwise stay open on top of this screen
    Keyboard.dismiss();
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    // accessibilityViewIsModal: VoiceOver (iOS) skips the form underneath. Android has no
    // equivalent on an overlay; the cover is up for about a second.
    <View
      className="absolute inset-0 items-center justify-center gap-4 bg-background p-6"
      accessibilityViewIsModal
    >
      <ActivityIndicator size="large" />
      <Text variant="muted">Signing you in…</Text>
      {slow ? (
        <View className="items-center gap-3">
          <Text variant="muted" className="text-center">
            This is taking longer than usual. Check your internet connection.
          </Text>
          {slowAction}
        </View>
      ) : null}
    </View>
  );
}
