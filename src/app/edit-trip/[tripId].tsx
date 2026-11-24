// Route: /edit-trip/<trip ID>, the "Edit trip" pop-up. Shown as a modal over the tabs (see the
// root layout). The screen lives in the trips feature.
export { EditTripScreen as default } from '@/features/trips';
// If this screen crashes while rendering, only it shows an error with "Try again"
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/screen-error-boundary';
