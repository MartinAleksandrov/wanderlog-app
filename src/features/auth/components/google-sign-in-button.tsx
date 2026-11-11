import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Image } from 'react-native';

import { showNotConnectedYet } from '../not-connected-yet';

// Google's logo, hosted by Clerk (the same image Clerk's own sign-in UI uses)
const GOOGLE_LOGO = { uri: 'https://img.clerk.com/static/google.png?width=160' };

// "Continue with Google". Not wired yet: Google sign-in needs the app's return address registered
// in Clerk, and in Expo Go that address contains the laptop's Wi-Fi IP, which keeps changing.
// It gets connected together with a stable app address in a later step.
export function GoogleSignInButton() {
  return (
    <Button variant="outline" onPress={() => showNotConnectedYet('Google sign-in')}>
      <Image source={GOOGLE_LOGO} className="size-4" accessibilityIgnoresInvertColors />
      <Text>Continue with Google</Text>
    </Button>
  );
}
