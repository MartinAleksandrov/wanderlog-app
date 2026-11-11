// Shape of what Clerk's methods return as `error`. For API failures (status 4xx) the top-level
// object is a wrapper; the user-facing text lives in its `errors` list, e.g.
// errors[0] = { code: 'form_password_length_too_short', longMessage: 'Passwords must be 15 characters or more.' }
type ClerkApiErrorItem = { code?: string; message?: string; longMessage?: string };
type ClerkErrorLike =
  | { code?: string; message: string; longMessage?: string; errors?: ClerkApiErrorItem[] }
  | null
  | undefined;

const FALLBACK = 'Something went wrong. Please try again.';

// Turns a Clerk error into text we can show the user: first the specific API error
// ("Password is incorrect…"), then the error's own user-facing text, then a generic fallback.
export function errorMessage(error: ClerkErrorLike): string | null {
  if (!error) return null;

  // In development, log the full error (Metro terminal / logcat) so the real cause is never hidden.
  // Production builds skip this.
  if (__DEV__) {
    console.warn('[auth] Clerk error', { code: error.code, message: error.message, error });
  }

  const first = error.errors?.[0];
  return first?.longMessage ?? first?.message ?? error.longMessage ?? FALLBACK;
}
