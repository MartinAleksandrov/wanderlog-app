import { reportError } from '@/lib/error-reporting';
import { ConvexError } from 'convex/values';
import { Alert } from 'react-native';

// Text to show the user for a failed backend call. Our Convex functions throw ConvexError with
// a message written for people; anything else (network, bugs) gets a generic message, because
// its text is meant for developers.
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === 'string') return error.data;
  return 'Something went wrong. Please try again.';
}

// A failed action the user started (save, delete, sign out…): tells them in a pop-up, and
// reports it when it's unexpected (a ConvexError is an expected answer, e.g. "no permission").
export function showError(title: string, error: unknown) {
  if (!(error instanceof ConvexError)) reportError(error, 'action');
  Alert.alert(title, errorMessage(error));
}
