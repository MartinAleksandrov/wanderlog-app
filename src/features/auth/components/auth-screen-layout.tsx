import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Compass } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// The frame shared by the sign-in and sign-up screens: Wanderlog logo and tagline on top,
// the form (children) below.
// - SafeAreaView keeps content clear of the status bar and the gesture bar.
// - KeyboardAvoidingView pushes the content up when the keyboard opens, so inputs stay visible.
// - ScrollView lets small phones scroll, and keeps taps working while the keyboard is open.
export function AuthScreenLayout({ children }: { children: ReactNode }) {
  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <ScrollView
            contentContainerClassName="flex-grow justify-center gap-8 p-6"
            keyboardShouldPersistTaps="handled"
          >
            <View className="items-center gap-3">
              <View className="size-14 items-center justify-center rounded-2xl bg-primary">
                <Icon as={Compass} className="size-7 text-primary-foreground" />
              </View>
              <Text variant="h3">Wanderlog</Text>
              <Text variant="muted">Plan every trip, day by day</Text>
            </View>

            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
