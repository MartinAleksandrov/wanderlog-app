import { Stack } from 'expo-router';

// The signed-out area: /sign-in and /sign-up. The group "(auth)" adds no URL segment;
// it exists so the root layout can protect all auth screens with one guard.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
