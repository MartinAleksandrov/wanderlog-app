import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useSignIn } from '@clerk/expo';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, type TextInput, View } from 'react-native';

import { errorMessage } from '../auth-errors';
import { EmailCodeForm } from './email-code-form';
import { GoogleSignInButton } from './google-sign-in-button';

type Stage = 'credentials' | 'email-code';

// Signs in an existing user with email + password through Clerk.
// Flow: password -> Clerk answers with a status:
//   'complete'            -> finalize() activates the session; the app switches to the tabs by itself
//   'needs_client_trust'  -> first sign-in on this device: Clerk emails a code (stage 'email-code')
export function SignInForm() {
  const { signIn, fetchStatus } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState<Stage>('credentials');
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // true while a request to Clerk is in flight; buttons are disabled meanwhile
  const busy = fetchStatus === 'fetching';
  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  // Helpers are declared before the handlers that call them: the React Compiler can't optimize
  // a component that calls a function defined further down.

  // Asks Clerk to email a 6-digit code and switches to the "Check your email" step
  async function sendCode() {
    const { error: sendError } = await signIn.mfa.sendEmailCode();
    if (sendError) {
      setError(errorMessage(sendError));
      return;
    }
    setError(null);
    setStage('email-code');
  }

  // Turns the finished sign-in into the active session (saved securely on the device).
  // No navigation here: the root layout notices the new session and shows the tabs.
  async function finishSignIn() {
    if (signIn.status !== 'complete') {
      setError('Sign-in could not be completed. Please try again.');
      return;
    }
    const { error: finalizeError } = await signIn.finalize();
    if (finalizeError) setError(errorMessage(finalizeError));
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setError(null);

    const { error: passwordError } = await signIn.password({
      emailAddress: email.trim(),
      password,
    });
    if (passwordError) {
      setError(errorMessage(passwordError));
      return;
    }

    if (signIn.status === 'complete') {
      await finishSignIn();
      return;
    }

    // A device Clerk hasn't seen before (or an account with 2-step sign-in): verify by email code
    const emailCodeAllowed = signIn.supportedSecondFactors.some(
      (factor) => factor.strategy === 'email_code',
    );
    if (
      (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') &&
      emailCodeAllowed
    ) {
      await sendCode();
      return;
    }

    setError('This account needs a sign-in step the app does not support yet.');
  }

  async function onVerifyCode(code: string) {
    setError(null);
    const { error: verifyError } = await signIn.mfa.verifyEmailCode({ code });
    if (verifyError) {
      setError(errorMessage(verifyError));
      return;
    }
    await finishSignIn();
  }

  async function backToCredentials() {
    await signIn.reset();
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
        <CardTitle className="text-center text-xl">Welcome back</CardTitle>
        <CardDescription className="text-center">
          Sign in to keep planning your trips
        </CardDescription>
      </CardHeader>

      <CardContent className="gap-6">
        <View className="gap-1.5">
          {/* Tapping a label focuses its input; nativeID + aria-labelledby link them for screen readers */}
          <Label nativeID="sign-in-email" onPress={() => emailRef.current?.focus()}>
            Email
          </Label>
          <Input
            ref={emailRef}
            aria-labelledby="sign-in-email"
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
          <Label nativeID="sign-in-password" onPress={() => passwordRef.current?.focus()}>
            Password
          </Label>
          <Input
            ref={passwordRef}
            aria-labelledby="sign-in-password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={() => void onSubmit()}
          />
        </View>

        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

        <Button onPress={() => void onSubmit()} disabled={!canSubmit}>
          <Text>{busy ? 'Signing in…' : 'Continue'}</Text>
        </Button>

        <View className="flex-row items-center">
          <Separator className="flex-1" />
          <Text className="px-4 text-sm text-muted-foreground">or</Text>
          <Separator className="flex-1" />
        </View>

        <GoogleSignInButton />

        <View className="flex-row justify-center">
          <Text className="text-sm text-muted-foreground">{"Don't have an account? "}</Text>
          <Link href="/sign-up" replace asChild>
            <Pressable>
              <Text className="text-sm font-medium underline">Sign up</Text>
            </Pressable>
          </Link>
        </View>
      </CardContent>
    </Card>
  );
}
