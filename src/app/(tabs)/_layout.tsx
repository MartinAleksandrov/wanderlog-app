import { SearchAreaProvider } from '@/features/places';
import { Tabs } from 'expo-router';
import { CircleUserIcon, HouseIcon, LandmarkIcon, MapIcon } from 'lucide-react-native';

// The four tabs of the signed-in app. Screens draw their own titles, so the tab headers are off.
// SearchAreaProvider sits above the map and places tabs so they share one search area.
export default function TabsLayout() {
  return (
    <SearchAreaProvider>
      <Tabs screenOptions={{ headerShown: false }}>
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
            tabBarIcon: ({ color, size }) => <LandmarkIcon color={color} size={size} />,
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
  );
}
