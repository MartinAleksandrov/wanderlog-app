// Route: /place/<Google place ID>, the pop-up with more about one place. Shown as a sheet that
// slides up over the tabs (see the root layout). The screen lives in the places feature.
export { PlaceDetailsSheet as default } from '@/features/places';
// If this screen crashes while rendering, only it shows an error with "Try again"
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/screen-error-boundary';
