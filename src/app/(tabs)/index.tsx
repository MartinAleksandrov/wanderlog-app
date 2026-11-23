// Route: / (first tab). Kept thin on purpose; the screen lives in the trips feature.
export { HomeScreen as default } from '@/features/trips';
// If this screen crashes while rendering, only it shows an error with "Try again"
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/screen-error-boundary';
