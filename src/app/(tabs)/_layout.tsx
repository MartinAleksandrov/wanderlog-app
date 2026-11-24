import { PlaceModeProvider, PlacesTabIcon, SearchAreaProvider } from '@/features/places';
import { MyLocationProvider } from '@/lib/my-location';
import { Tabs } from 'expo-router';
import { CalendarDaysIcon, CircleUserIcon, HouseIcon, MapIcon } from 'lucide-react-native';

// The five tabs of the signed-in app. Screens draw their own titles, so the tab headers are off.
// Above the tabs sit what they share: where the phone is (MyLocationProvider, for "350 m away"),
// which side is switched on (sights or sweet spots, PlaceModeProvider) and the search area
// (SearchAreaProvider).
export default function TabsLayout() {
  return (
    <MyLocationProvider>
      <PlaceModeProvider>
        <SearchAreaProvider>
          <Tabs
            screenOptions={{ headerShown: false }}
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
                tabBarIcon: ({ color, size }) => <HouseIcon color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="map"
              options={{
                title: 'Map',
                tabBarIcon: ({ color, size }) => <MapIcon color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="places"
              options={{
                title: 'Places',
                tabBarIcon: ({ color, size }) => <PlacesTabIcon color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="plan"
              options={{
                title: 'Plan',
                tabBarIcon: ({ color, size }) => <CalendarDaysIcon color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="account"
              options={{
                title: 'Account',
                tabBarIcon: ({ color, size }) => <CircleUserIcon color={color} size={size} />,
              }}
            />
          </Tabs>
        </SearchAreaProvider>
      </PlaceModeProvider>
    </MyLocationProvider>
  );
}
