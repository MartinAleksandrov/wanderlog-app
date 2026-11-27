import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { formatDateRange } from '@/lib/dates';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Fragment, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Section } from './components/section';
import { StatTile } from './components/stat-tile';
import { UserActions } from './components/user-actions';
import { displayName, UserAvatar, UserBadges } from './components/user-identity';
import { REQUEST_KIND_LABELS, formatJoined, formatLastSeen, formatNumber } from './format';

type AdminUser = NonNullable<FunctionReturnType<typeof api.admin.user>>;

// One person's page on the admin dashboard (/admin/user/<ID>, from the dashboard's users list):
// their account, how many Google requests they made of each kind, their phones and trips, and
// Suspend / Restore access / Delete data. Live, like the dashboard.
export function AdminUserScreen() {
  // A plain string from the URL; admin.user checks that it's a user ID
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const user = useQuery(api.admin.user, { userId });

  if (user === undefined) return <ActivityIndicator className="flex-1 bg-background" />;
  if (user === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text variant="muted" className="text-center">
          {"This user doesn't exist, or you aren't an admin."}
        </Text>
      </View>
    );
  }
  return <UserPage user={user} />;
}

function UserPage({ user }: { user: AdminUser }) {
  // "5 min ago" moves on by itself while the page stays open
  const now = useNow();
  const { bottom } = useSafeAreaInsets();
  const name = displayName(user);
  const suspended = user.suspendedAt !== undefined;
  const sum = (key: 'today' | 'thisWeek' | 'allTime') =>
    user.requests.reduce((total, kind) => total + kind[key], 0);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-8 p-4"
      contentContainerStyle={{ paddingBottom: bottom + 24 }}
    >
      {/* The header shows the person's name instead of "User" */}
      <Stack.Screen options={{ title: name }} />

      <View className="items-center gap-2">
        <UserAvatar imageUrl={user.imageUrl} name={name} size={72} />
        <View className="flex-row flex-wrap items-center justify-center gap-2">
          <Text variant="large">{name}</Text>
          <UserBadges role={user.role} suspended={suspended} />
        </View>
        {user.name && user.email ? <Text variant="muted">{user.email}</Text> : null}
      </View>

      <Card className="gap-0 py-0">
        <InfoRow label="Joined" value={formatJoined(user.joinedAt)} />
        <Separator />
        <InfoRow label="Last seen" value={formatLastSeen(user.lastSeenAt, now)} />
        <Separator />
        <InfoRow
          label="Status"
          value={
            user.suspendedAt === undefined
              ? 'Active'
              : `Suspended on ${formatJoined(user.suspendedAt)}`
          }
        />
        {user.dataDeletedAt !== undefined ? (
          <>
            <Separator />
            <InfoRow label="Data deleted" value={formatJoined(user.dataDeletedAt)} />
          </>
        ) : null}
        <Separator />
        {/* Selectable, to search for the same person in the Clerk dashboard */}
        <InfoRow
          label="Clerk ID"
          value={
            <Text className="flex-1 text-right font-mono text-xs" selectable numberOfLines={1}>
              {user.clerkUserId}
            </Text>
          }
        />
      </Card>

      <Section
        title="Google requests"
        description="Paid requests to Google Places this person made (UTC days). All time means since counting began."
      >
        <View className="flex-row gap-3">
          <StatTile label="Today" value={formatNumber(sum('today'))} />
          <StatTile label="7 days" value={formatNumber(sum('thisWeek'))} />
          <StatTile label="All time" value={formatNumber(sum('allTime'))} />
        </View>
        <RequestsTable requests={user.requests} />
      </Section>

      <Section title="Phones">
        <Card className="gap-0 py-0">
          {user.devices.length === 0 ? (
            <Text variant="muted" className="p-4">
              No phones noted yet.
            </Text>
          ) : (
            user.devices.map((device, index) => (
              <Fragment key={device._id}>
                {index > 0 ? <Separator /> : null}
                <View className="gap-0.5 px-4 py-3">
                  <Text className="font-medium">{device.name}</Text>
                  <Text variant="muted">
                    {device.osVersion}
                    {device.appVersion ? ` · Wandr ${device.appVersion}` : ''}
                  </Text>
                  <Text variant="muted">Last seen {formatLastSeen(device.lastSeenAt, now)}</Text>
                </View>
              </Fragment>
            ))
          )}
        </Card>
      </Section>

      <Section title="Trips">
        <Card className="gap-0 py-0">
          {user.trips.length === 0 ? (
            <Text variant="muted" className="p-4">
              No trips.
            </Text>
          ) : (
            user.trips.map((trip, index) => (
              <Fragment key={trip._id}>
                {index > 0 ? <Separator /> : null}
                <View className="gap-0.5 px-4 py-3">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 font-medium" numberOfLines={1}>
                      {trip.name}
                    </Text>
                    {/* Their role, when the trip is someone else's */}
                    {trip.role !== 'owner' ? (
                      <Text variant="muted" className="capitalize">
                        {trip.role}
                      </Text>
                    ) : null}
                  </View>
                  <Text variant="muted" numberOfLines={1}>
                    {trip.destination} · {formatDateRange(trip.startDate, trip.endDate)}
                  </Text>
                  <Text variant="muted">
                    {trip.placeCount} {trip.placeCount === 1 ? 'place' : 'places'} ·{' '}
                    {trip.bookingCount} {trip.bookingCount === 1 ? 'booking' : 'bookings'}
                  </Text>
                </View>
              </Fragment>
            ))
          )}
        </Card>
      </Section>

      <Section title="Account">
        <UserActions user={{ ...user, suspended }} name={name} />
      </Section>
    </ScrollView>
  );
}

// Requests per kind, three numbers each: a table, since every row has the same three columns
function RequestsTable({ requests }: { requests: AdminUser['requests'] }) {
  return (
    <Card className="gap-0 py-0">
      <View className="flex-row gap-2 px-4 py-2">
        <Text className="flex-1 text-xs text-muted-foreground">Kind</Text>
        <NumberCell header>Today</NumberCell>
        <NumberCell header>7 days</NumberCell>
        <NumberCell header>All time</NumberCell>
      </View>
      {requests.map((row) => (
        <Fragment key={row.kind}>
          <Separator />
          <View
            className="flex-row items-center gap-2 px-4 py-3"
            accessible
            accessibilityLabel={`${REQUEST_KIND_LABELS[row.kind]}: ${row.today} today, ${row.thisWeek} in 7 days, ${row.allTime} in all`}
          >
            <Text className="flex-1 text-sm">{REQUEST_KIND_LABELS[row.kind]}</Text>
            <NumberCell>{formatNumber(row.today)}</NumberCell>
            <NumberCell>{formatNumber(row.thisWeek)}</NumberCell>
            <NumberCell>{formatNumber(row.allTime)}</NumberCell>
          </View>
        </Fragment>
      ))}
    </Card>
  );
}

// A right-aligned column of fixed width, so the numbers line up under their heading. The width is
// on a View: on the Text itself it was ignored, and each number took only its own width.
function NumberCell({ children, header = false }: { children: ReactNode; header?: boolean }) {
  return (
    <View className="w-16">
      <Text className={cn('text-right', header ? 'text-xs text-muted-foreground' : 'text-sm')}>
        {children}
      </Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-4 px-4 py-3">
      <Text variant="muted">{label}</Text>
      {typeof value === 'string' ? <Text className="font-medium">{value}</Text> : value}
    </View>
  );
}
