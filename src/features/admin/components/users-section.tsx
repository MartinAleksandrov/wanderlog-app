import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useNow } from '@/lib/use-now';
import type { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { useRouter } from 'expo-router';
import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon } from 'lucide-react-native';
import { Fragment, useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatLastSeen, formatNumber } from '../format';
import { displayName, UserAvatar, UserBadges } from './user-identity';

type DashboardUser = NonNullable<FunctionReturnType<typeof api.admin.dashboard>>['users'][number];

// Everyone who has signed in, in one card that opens and closes, so the numbers above stay in
// view. Most recently seen first.
export function UsersSection({ users }: { users: DashboardUser[] }) {
  const [open, setOpen] = useState(false);
  // "5 min ago" moves on by itself while the screen stays open
  const now = useNow();

  return (
    <Card className="gap-0 py-0">
      <Pressable
        onPress={() => setOpen((isOpen) => !isOpen)}
        className="flex-row items-center justify-between px-4 py-4"
        accessibilityRole="button"
        accessibilityLabel={`Users, ${users.length}`}
        accessibilityState={{ expanded: open }}
      >
        <Text className="text-lg font-semibold">Users</Text>
        <View className="flex-row items-center gap-2">
          <Text variant="muted">{formatNumber(users.length)}</Text>
          <Icon
            as={open ? ChevronUpIcon : ChevronDownIcon}
            className="size-5 text-muted-foreground"
          />
        </View>
      </Pressable>
      {open
        ? users.map((user) => (
            <Fragment key={user._id}>
              <Separator />
              <UserRow user={user} now={now} />
            </Fragment>
          ))
        : null}
    </Card>
  );
}

// One person: tap for their page (/admin/user/<ID>)
function UserRow({ user, now }: { user: DashboardUser; now: number }) {
  const router = useRouter();
  const name = displayName(user);
  const details = [
    `${user.tripCount} ${user.tripCount === 1 ? 'trip' : 'trips'}`,
    `${formatNumber(user.requestsThisWeek)} requests this week`,
  ];

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/admin/user/[userId]', params: { userId: user._id } })
      }
      className="flex-row items-center gap-3 px-4 py-3 active:bg-muted"
      accessibilityRole="button"
      accessibilityHint="Opens this user's page"
    >
      <UserAvatar imageUrl={user.imageUrl} name={name} />
      <View className="flex-1 gap-0.5">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="font-medium" numberOfLines={1}>
            {name}
          </Text>
          <UserBadges role={user.role} suspended={user.suspended} />
        </View>
        {user.name && user.email ? (
          <Text variant="muted" numberOfLines={1}>
            {user.email}
          </Text>
        ) : null}
        <Text variant="muted" numberOfLines={1}>
          {formatLastSeen(user.lastSeenAt, now)}
          {user.device ? ` · ${user.device}` : ''}
        </Text>
        <Text variant="muted">{details.join(' · ')}</Text>
      </View>
      <Icon as={ChevronRightIcon} className="size-5 text-muted-foreground" />
    </Pressable>
  );
}
