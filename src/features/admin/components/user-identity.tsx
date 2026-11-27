import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { Image } from 'expo-image';
import { View } from 'react-native';

// How a person looks on the dashboard and on their own page: photo, name and status badges

// The name to show: the name, or the email, for accounts whose token had no name
export function displayName(user: { name?: string; email?: string }): string {
  return user.name ?? user.email ?? 'No name yet';
}

// The profile photo, or the first letter on a grey circle (rows made before the sign-in token
// carried a photo have none)
export function UserAvatar({
  imageUrl,
  name,
  size = 40,
}: {
  imageUrl?: string;
  name: string;
  size?: number;
}) {
  const circle = { width: size, height: size, borderRadius: size / 2 };
  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={circle} accessibilityIgnoresInvertColors />;
  }
  return (
    <View className="items-center justify-center bg-muted" style={circle}>
      <Text className="font-semibold text-muted-foreground">{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

// Admin and Suspended badges after the name. Suspended is in the error colour, and always says
// so in words, not only in colour.
export function UserBadges({ role, suspended }: { role: 'admin' | 'user'; suspended: boolean }) {
  return (
    <>
      {role === 'admin' ? <Badge label="Admin" /> : null}
      {suspended ? <Badge label="Suspended" destructive /> : null}
    </>
  );
}

function Badge({ label, destructive = false }: { label: string; destructive?: boolean }) {
  return (
    <View
      className={cn('rounded-full px-2 py-0.5', destructive ? 'bg-destructive/10' : 'bg-muted')}
    >
      <Text
        className={cn(
          'text-xs font-medium',
          destructive ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {label}
      </Text>
    </View>
  );
}
