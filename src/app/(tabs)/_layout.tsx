import { PlaceModeProvider, PlacesTabIcon, SearchAreaProvider } from '@/features/places';
import { Tabs } from 'expo-router';
import { CircleUserIcon, HouseIcon, MapIcon } from 'lucide-react-native';

// The four tabs of the signed-in app. Screens draw their own titles, so the tab headers are off.
// Above the map and places tabs sit what they share: which side is switched on (sights or sweet
// spots, PlaceModeProvider) and the search area (SearchAreaProvider).
export default function TabsLayout() {
  return (
    <PlaceModeProvider>
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
              tabBarIcon: ({ color, size }) => <PlacesTabIcon color={color} size={size} />,
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
  );
}
