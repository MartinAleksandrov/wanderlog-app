import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PlaneTakeoff } from 'lucide-react-native';
import { View } from 'react-native';

// Temporary screen to prove the component library works: themed Card, Text, Button and an icon.
// It gets replaced by the real trips screen later.
export default function TripsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Wanderlog</CardTitle>
          <CardDescription>React Native Reusables + Uniwind</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          <Button>
            <Icon as={PlaneTakeoff} />
            <Text>Plan a trip</Text>
          </Button>
          <Button variant="outline">
            <Text>Outline button</Text>
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
