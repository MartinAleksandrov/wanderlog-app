import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { SignOutButton } from '@/features/auth';
import { useUser } from '@clerk/expo';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// The fifth tab: who is signed in, and sign out. Name, email, photo and join date come from
// Clerk (the account's owner); the app role and trip count come from our backend.
export function AccountScreen() {
  const { user } = useUser();
  const me = useQuery(api.users.me);

  const email = user?.primaryEmailAddress?.emailAddress;
  const name = user?.fullName || email?.split('@')[0] || 'Traveller';

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerClassName="gap-6 p-4">
          <Text variant="h3">Account</Text>

          <View className="items-center gap-3">
            {user?.imageUrl ? (
              <Image
                source={{ uri: user.imageUrl }}
                style={{ width: 88, height: 88, borderRadius: 44 }}
                accessibilityLabel="Profile photo"
              />
            ) : null}
            <View className="items-center gap-1">
              <Text variant="large">{name}</Text>
              {email ? <Text variant="muted">{email}</Text> : null}
            </View>
          </View>

          <Card className="gap-0 py-0">
            <InfoRow
              label="Role"
              value={me ? (me.role === 'admin' ? 'Admin' : 'Traveller') : '…'}
            />
            <Separator />
            <InfoRow label="Trips" value={me ? String(me.tripCount) : '…'} />
            <Separator />
            <InfoRow
              label="Member since"
              value={
                user?.createdAt
                  ? user.createdAt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
                  : '…'
              }
            />
          </Card>

          <SignOutButton />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Text variant="muted">{label}</Text>
      <Text className="font-medium">{value}</Text>
    </View>
  );
}
