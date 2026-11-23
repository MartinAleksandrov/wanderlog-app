// Route: /sign-in. Kept thin on purpose; the screen itself lives in the auth feature.
export { SignInScreen as default } from '@/features/auth';
// If this screen crashes while rendering, only it shows an error with "Try again"
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/screen-error-boundary';
