// Configuration read from .env.local. Expo copies variables whose names start with EXPO_PUBLIC_
// into the app's JavaScript when Metro bundles it, so they end up on the phone in plain text.
// That's fine for these two (a publishable key and a URL are public by design), but never put
// a secret in an EXPO_PUBLIC_ variable.
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is missing. Add it to .env.local and restart Metro.`);
  }
  return value;
}

export const env = {
  // Identifies our Clerk app to the Clerk SDK (starts with pk_test_ or pk_live_)
  clerkPublishableKey: required(
    'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  ),
  // Address of our Convex deployment; written to .env.local by `npx convex dev`
  convexUrl: required('EXPO_PUBLIC_CONVEX_URL', process.env.EXPO_PUBLIC_CONVEX_URL),
};
