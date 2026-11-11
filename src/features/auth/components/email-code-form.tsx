import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useState } from 'react';
import { View } from 'react-native';

const CODE_LENGTH = 6;

type EmailCodeFormProps = {
  email: string;
  busy: boolean;
  error: string | null;
  onVerify: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
};

// The "check your email" step, shared by sign-up and sign-in. Clerk emailed a 6-digit code;
// typing it proves the user owns that address (sign-up) or this device is really theirs (sign-in
// from a new device). The parent form decides what happens with the code.
export function EmailCodeForm({
  email,
  busy,
  error,
  onVerify,
  onResend,
  onBack,
}: EmailCodeFormProps) {
  const [code, setCode] = useState('');
  const canVerify = code.length === CODE_LENGTH && !busy;

  function verify() {
    if (canVerify) onVerify(code);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-xl">Check your email</CardTitle>
        <CardDescription className="text-center">
          Enter the {CODE_LENGTH}-digit code we sent to {email}
        </CardDescription>
      </CardHeader>

      <CardContent className="gap-6">
        <View className="gap-1.5">
          <Label nativeID="email-code">Verification code</Label>
          <Input
            aria-labelledby="email-code"
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={verify}
          />
        </View>

        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

        <Button onPress={verify} disabled={!canVerify}>
          <Text>{busy ? 'Checking…' : 'Verify'}</Text>
        </Button>

        <View className="flex-row justify-between">
          <Button variant="link" size="sm" onPress={onBack} disabled={busy}>
            <Text>Back</Text>
          </Button>
          <Button variant="link" size="sm" onPress={onResend} disabled={busy}>
            <Text>Resend code</Text>
          </Button>
        </View>
      </CardContent>
    </Card>
  );
}
