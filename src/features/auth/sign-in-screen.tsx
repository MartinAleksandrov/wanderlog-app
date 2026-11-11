import { AuthScreenLayout } from './components/auth-screen-layout';
import { SignInForm } from './components/sign-in-form';

// The screen the app opens on when nobody is signed in.
export function SignInScreen() {
  return (
    <AuthScreenLayout>
      <SignInForm />
    </AuthScreenLayout>
  );
}
