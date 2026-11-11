import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useSignUp } from '@clerk/expo';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, type TextInput, View } from 'react-native';

import { errorMessage } from '../auth-errors';
import { EmailCodeForm } from './email-code-form';

type Stage = 'credentials' | 'email-code';

// Creates a new account through Clerk.
// Flow: email + password -> Clerk emails a 6-digit code -> user enters it -> finalize() signs
// the new user in; the app then switches to the tabs by itself.
export function SignUpForm() {
  const { signUp, fetchStatus } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState<Stage>('credentials');
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const busy = fetchStatus === 'fetching';
  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  // Declared before onSubmit, which calls it: the React Compiler can't optimize a component that
  // calls a function defined further down.
  // Asks Clerk to email a 6-digit code and switches to the "Check your email" step
  async function sendCode() {
    const { error: sendError } = await signUp.verifications.sendEmailCode();
    if (sendError) {
      setError(errorMessage(sendError));
      return;
    }
    setError(null);
    setStage('email-code');
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setError(null);

    // Clerk checks the password rules here (length, known data breaches) and rejects bad ones
    const { error: passwordError } = await signUp.password({
      emailAddress: email.trim(),
      password,
    });
    if (passwordError) {
      setError(errorMessage(passwordError));
      return;
    }
    await sendCode();
  }

  async function onVerifyCode(code: string) {
    setError(null);
    const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code });
    if (verifyError) {
      setError(errorMessage(verifyError));
      return;
    }

    if (signUp.status !== 'complete') {
      // Happens if the Clerk dashboard requires more fields (e.g. a name) than this form collects
      setError('Clerk needs more details to finish sign-up. Check the required fields in Clerk.');
      return;
    }
    const { error: finalizeError } = await signUp.finalize();
    if (finalizeError) setError(errorMessage(finalizeError));
  }

  async function backToCredentials() {
    await signUp.reset();
    setPassword('');
    setError(null);
    setStage('credentials');
  }

  if (stage === 'email-code') {
    return (
      <EmailCodeForm
        email={email.trim()}
        busy={busy}
        error={error}
        onVerify={(code) => void onVerifyCode(code)}
        onResend={() => void sendCode()}
        onBack={() => void backToCredentials()}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-xl">Create your account</CardTitle>
        <CardDescription className="text-center">Start planning your first trip</CardDescription>
      </CardHeader>

      <CardContent className="gap-6">
        <View className="gap-1.5">
          <Label nativeID="sign-up-email" onPress={() => emailRef.current?.focus()}>
            Email
          </Label>
          <Input
            ref={emailRef}
            aria-labelledby="sign-up-email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </View>

        <View className="gap-1.5">
          <Label nativeID="sign-up-password" onPress={() => passwordRef.current?.focus()}>
            Password
          </Label>
          <Input
            ref={passwordRef}
            aria-labelledby="sign-up-password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="go"
            onSubmitEditing={() => void onSubmit()}
          />
          {/* Must match Clerk dashboard → Configure → Passwords (minimum length is set there) */}
          <Text variant="muted">At least 15 characters</Text>
        </View>

        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

        <Button onPress={() => void onSubmit()} disabled={!canSubmit}>
          <Text>{busy ? 'Creating account…' : 'Create account'}</Text>
        </Button>

        <View className="flex-row justify-center">
          <Text className="text-sm text-muted-foreground">Already have an account? </Text>
          <Link href="/sign-in" replace asChild>
            <Pressable>
              <Text className="text-sm font-medium underline">Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </CardContent>
    </Card>
  );
}
