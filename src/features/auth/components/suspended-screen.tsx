import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ShieldBanIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { SignOutButton } from './sign-out-button';

// Covers the whole app when an admin has suspended the account (users.me says so). Signing in
// still works, since the Clerk account stays, but the backend refuses everything else, so this
// is all a suspended person can see. Sign out is the one way off it: to sign in with another
// account.
//
// A cover over the navigator, like SigningInScreen, rather than a route of its own: Expo Router
// needs the Stack mounted, and this way no redirect has to know about suspension. The screens
// underneath show nothing anyway, because every query answers a suspended caller with nothing.
export function SuspendedScreen() {
  return (
    // accessibilityViewIsModal: VoiceOver (iOS) skips the app underneath
    <View
      className="absolute inset-0 items-center justify-center gap-6 bg-background p-6"
      accessibilityViewIsModal
    >
      <Icon as={ShieldBanIcon} className="size-12 text-destructive" />
      <View className="items-center gap-2">
        <Text variant="h3" className="text-center">
          Your account was suspended
        </Text>
        <Text variant="muted" className="text-center text-base">
          An admin has suspended your Wandr account, so you can no longer use this app. If you think
          this is a mistake, contact the admin of Wandr.
        </Text>
      </View>
      <SignOutButton />
    </View>
  );
}
