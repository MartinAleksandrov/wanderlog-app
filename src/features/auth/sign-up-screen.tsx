import { AuthScreenLayout } from './components/auth-screen-layout';
import { SignUpForm } from './components/sign-up-form';

// Account creation, reached from the "Sign up" link on the sign-in screen.
export function SignUpScreen() {
  return (
    <AuthScreenLayout>
      <SignUpForm />
    </AuthScreenLayout>
  );
}
