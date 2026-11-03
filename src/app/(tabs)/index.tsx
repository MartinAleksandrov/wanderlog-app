import { Text, View } from 'react-native';

// Temporary screen to prove Uniwind works: plain React Native components styled with Tailwind classes.
// It gets replaced when the login and trips screens arrive.
export default function TripsScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-sky-50">
      <Text className="text-3xl font-bold text-sky-900">Wanderlog</Text>
      <Text className="text-base text-sky-700">Styled with Uniwind</Text>
    </View>
  );
}
