import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { Stack } from 'expo-router';
const convex = new ConvexReactClient('https://notable-sockeye-345.eu-west-1.convex.cloud');

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <Stack screenOptions={{ headerShown: false }} />
    </ConvexProvider>
  );
}
