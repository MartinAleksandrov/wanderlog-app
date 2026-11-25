import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { reportError } from '@/lib/error-reporting';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { CheckIcon, CopyIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

// How long the button says "Copied" before going back to "Copy"
const COPIED_MS = 1500;

// A booking's reference, big enough to read out at a desk, with a button that copies it (for
// an airline's check-in page or a message to the hotel). The button says "Copied" for a moment.
export function ConfirmationCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  function copy() {
    Clipboard.setStringAsync(code)
      .then(() => {
        setCopied(true);
        void Haptics.selectionAsync();
      })
      .catch((error: unknown) => reportError(error, 'action'));
  }

  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-muted px-3 py-2">
      <View className="flex-1">
        <Text variant="muted" className="text-xs">
          Booking code
        </Text>
        {/* selectable: a long press copies it too, or part of it */}
        <Text selectable className="font-mono text-base font-semibold tracking-wider">
          {code}
        </Text>
      </View>
      <Button variant="ghost" size="sm" onPress={copy} aria-label={`Copy booking code ${code}`}>
        <Icon as={copied ? CheckIcon : CopyIcon} className="size-4" />
        <Text>{copied ? 'Copied' : 'Copy'}</Text>
      </Button>
    </View>
  );
}
