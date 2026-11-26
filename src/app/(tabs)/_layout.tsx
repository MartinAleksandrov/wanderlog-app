import { PlaceModeProvider, SearchAreaProvider, usePlaceMode } from '@/features/places';
import { MyLocationProvider } from '@/lib/my-location';
import { cn } from '@/lib/utils';
import { Tabs } from 'expo-router';
import {
  CalendarDaysIcon,
  CircleUserIcon,
  HouseIcon,
  MapIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { View, type ColorValue } from 'react-native';
import { useUniwind } from 'uniwind';

// The active tab's colour: the app's action blue (directions, "Turn on"), as a plain string for
// React Navigation, which can't read Tailwind classes. Lighter in dark mode to stay readable.
const ACTIVE_TINT = { light: '#2563eb', dark: '#60a5fa' };

// The five tabs of the signed-in app. Screens draw their own titles, so the tab headers are off.
// Above the tabs sit what they share: where the phone is (MyLocationProvider, for "350 m away"),
// which side is switched on (sights, sweet spots or restaurants, PlaceModeProvider) and the
// search area (SearchAreaProvider).
export default function TabsLayout() {
  return (
    <MyLocationProvider>
      <PlaceModeProvider>
        <SearchAreaProvider>
          <AppTabs />
        </SearchAreaProvider>
      </PlaceModeProvider>
    </MyLocationProvider>
  );
}

// The tabs themselves, inside the providers so the places tab can follow the switch: its icon
// and its name are the side's (a landmark and "Places", a croissant and "Cafes", a fork and
// knife and "Restaurants")
function AppTabs() {
  const { mode } = usePlaceMode();
  const { theme } = useUniwind();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // The active tab's icon and name in blue, its icon on a pill (TabIcon)
        tabBarActiveTintColor: ACTIVE_TINT[theme === 'dark' ? 'dark' : 'light'],
        // Room for the pill: React Navigation's icon box is 31 × 28 dp, the pill 56 × 32. Five
        // tabs share the width, so on a small phone (320 dp, or Android's largest display size)
        // each has 64 dp, and the pills still keep apart.
        tabBarIconStyle: { width: 56, height: 32 },
        tabBarLabelStyle: { fontWeight: '600' },
      }}
      // Keep tabs in the window when they're not shown (Android detaches them by default).
      // The map can't take changes while detached: react-native-maps parks its pins and
      // can't remove the old ones, which then come back as empty red pins. Changes made
      // from another tab (saving a place in the list, "Show on map" in the plan) reach
      // the map while it's hidden, so it must stay attached.
      detachInactiveScreens={false}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: (props) => <TabIcon icon={HouseIcon} {...props} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: (props) => <TabIcon icon={MapIcon} {...props} />,
        }}
      />
      <Tabs.Screen
        name="places"
        options={{
          title: mode.tabTitle,
          tabBarIcon: (props) => <TabIcon icon={mode.icon} {...props} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: (props) => <TabIcon icon={CalendarDaysIcon} {...props} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: (props) => <TabIcon icon={CircleUserIcon} {...props} />,
        }}
      />
    </Tabs>
  );
}

// A tab's icon. The active tab's sits on a soft blue pill (Material 3's "active indicator"), so
// the tab you're on is clear at a glance, and stays marked for as long as you're on it. React
// Navigation draws every icon twice, the active and the inactive look on top of each other, and
// fades between them; `focused` says which of the two this is.
function TabIcon({
  icon: TabIconShape,
  focused,
  color,
}: {
  icon: LucideIcon;
  focused: boolean;
  color: ColorValue;
}) {
  return (
    <View
      className={cn(
        'h-8 w-14 items-center justify-center rounded-full',
        focused && 'bg-blue-100 dark:bg-blue-950',
      )}
    >
      <TabIconShape color={color} size={22} />
    </View>
  );
}
