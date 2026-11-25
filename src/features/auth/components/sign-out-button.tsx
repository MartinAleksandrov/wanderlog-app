import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { showError } from '@/lib/error-message';
import { useAuth } from '@clerk/expo';
import { LogOutIcon } from 'lucide-react-native';

// Ends the Clerk session and deletes the saved token from the device. Convex then sees no
// signed-in user, the root layout's guards flip, and the app moves to the sign-in screen by itself.
export function SignOutButton() {
  const { signOut } = useAuth();

  return (
    <Button
      variant="outline"
      onPress={() =>
        // Signing out talks to Clerk's servers, so it can fail without a connection
        void signOut().catch((error: unknown) => showError("Couldn't sign out", error))
      }
    >
      <Icon as={LogOutIcon} />
      <Text>Sign out</Text>
    </Button>
  );
}
