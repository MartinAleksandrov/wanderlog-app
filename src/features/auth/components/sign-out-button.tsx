import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@clerk/expo';
import { LogOut } from 'lucide-react-native';

// Ends the Clerk session and deletes the saved token from the device. Convex then sees no
// signed-in user, the root layout's guards flip, and the app moves to the sign-in screen by itself.
export function SignOutButton() {
  const { signOut } = useAuth();

  return (
    <Button variant="outline" onPress={() => void signOut()}>
      <Icon as={LogOut} />
      <Text>Sign out</Text>
    </Button>
  );
}
