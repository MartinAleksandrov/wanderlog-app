import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { useQuery } from 'convex/react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarList } from './components/bar-list';
import { RequestsChart } from './components/requests-chart';
import { Section } from './components/section';
import { StatTile } from './components/stat-tile';
import { UsersSection } from './components/users-section';
import { REQUEST_KIND_LABELS, formatNumber, formatRowCount } from './format';

type Dashboard = NonNullable<FunctionReturnType<typeof api.admin.dashboard>>;

// The admin dashboard (/admin, opened from the account tab, admins only): who uses the app and
// how much, what they use it on, what it costs in Google requests, and everyone's accounts.
// A live query: the numbers move by themselves as people use the app.
export function AdminDashboardScreen() {
  const dashboard = useQuery(api.admin.dashboard);

  if (dashboard === undefined) return <ActivityIndicator className="flex-1 bg-background" />;
  // Someone who isn't an admin opened the link (wandr://admin): the backend sends nothing
  if (dashboard === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text variant="muted">Only admins can see the dashboard.</Text>
      </View>
    );
  }
  return <DashboardPage dashboard={dashboard} />;
}

function DashboardPage({ dashboard }: { dashboard: Dashboard }) {
  const { people, content, requests, models, users } = dashboard;
  // Room for Android's navigation bar, which the app draws under (edge to edge)
  const { bottom } = useSafeAreaInsets();
  const requestsThisWeek = requests.byDay.reduce((total, day) => total + day.count, 0);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-8 p-4"
      contentContainerStyle={{ paddingBottom: bottom + 24 }}
    >
      <Section title="People">
        <View className="flex-row gap-3">
          <StatTile
            label="Users"
            value={formatRowCount(people.total)}
            hint={`${formatNumber(people.newThisWeek)} new this week`}
          />
          <StatTile label="Active today" value={formatNumber(people.activeToday)} />
        </View>
        <View className="flex-row gap-3">
          <StatTile label="Active this week" value={formatNumber(people.activeThisWeek)} />
          <StatTile label="Active this month" value={formatNumber(people.activeThisMonth)} />
        </View>
        {people.suspended > 0 ? (
          <Text variant="muted">
            {formatNumber(people.suspended)} suspended{' '}
            {people.suspended === 1 ? 'account' : 'accounts'}
          </Text>
        ) : null}
        <UsersSection users={users} />
      </Section>

      <Section
        title="Google requests"
        description={`Paid requests to Google Places, the last 7 days (UTC): ${formatNumber(requestsThisWeek)} in all. Map photos aren't counted.`}
      >
        <Card className="gap-0 p-4">
          <RequestsChart days={requests.byDay} />
        </Card>
        <Card className="gap-0 p-4">
          <BarList
            rows={requests.byKind.map(({ kind, count }) => ({
              name: REQUEST_KIND_LABELS[kind],
              count,
            }))}
          />
        </Card>
      </Section>

      <Section title="Phones" description="People per phone model, from their latest app start.">
        <Card className="gap-0 p-4">
          {models.length > 0 ? (
            <BarList rows={models} />
          ) : (
            <Text variant="muted">No phones noted yet.</Text>
          )}
        </Card>
      </Section>

      <Section title="Content" description="Everything saved in the app, by everyone.">
        <View className="flex-row gap-3">
          <StatTile label="Trips" value={formatRowCount(content.trips)} />
          <StatTile label="Places" value={formatRowCount(content.places)} />
          <StatTile label="Bookings" value={formatRowCount(content.bookings)} />
        </View>
      </Section>
    </ScrollView>
  );
}
