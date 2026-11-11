import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { SignOutButton } from '@/features/auth';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { View } from 'react-native';

// Temporary home screen until the trips feature exists. It asks the Convex backend "who am I?",
// which proves the whole chain works: Clerk signed you in, and Convex trusts that sign-in.
export default function TripsScreen() {
  // undefined = still loading, null = Convex didn't recognise the user, otherwise the user
  const viewer = useQuery(api.users.viewer);

  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{"You're signed in"}</CardTitle>
          <CardDescription>
            {viewer === undefined
              ? 'Asking the backend who you are…'
              : viewer === null
                ? 'The backend did not recognise this sign-in.'
                : `Convex knows you as ${viewer.email ?? viewer.clerkUserId}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          {viewer ? <Text variant="muted">Clerk user ID: {viewer.clerkUserId}</Text> : null}
          <SignOutButton />
        </CardContent>
      </Card>
    </View>
  );
}
