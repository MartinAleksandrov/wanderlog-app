import { showError } from '@/lib/error-message';
import { Linking } from 'react-native';

// Opens a website, a phone number (tel:…) or a Google Maps link in the matching app, and says
// so when the phone can't open it
export function openLink(url: string) {
  Linking.openURL(url).catch((error: unknown) => showError("Couldn't open the link", error));
}
