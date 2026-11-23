// Route: /places (third tab). The screen lives in the places feature.
export { PlacesScreen as default } from '@/features/places';
// If this screen crashes while rendering, only it shows an error with "Try again"
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/screen-error-boundary';
