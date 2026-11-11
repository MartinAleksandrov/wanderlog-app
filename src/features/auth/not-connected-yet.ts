import { Alert } from 'react-native';

// Temporary: shown by buttons whose feature isn't built yet (Google sign-in).
// Delete this file once every button does real work.
export function showNotConnectedYet(action: string) {
  Alert.alert('Not available yet', `${action} is coming in a later step.`);
}
