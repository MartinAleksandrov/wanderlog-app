import { useQuery } from 'convex/react';
import { Text, View } from 'react-native';
import { api } from '../../../convex/_generated/api';

export default function Saved() {
  const data = useQuery(api.functions.myQuery);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{data?.[0]?.name}</Text>
    </View>
  );
}
