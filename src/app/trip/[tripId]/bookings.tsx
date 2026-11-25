// Route: /trip/<trip ID>/bookings, the trip's hotels, flights, transport and tickets. Pushed over
// the tabs with a header and a back arrow (see the root layout). The screen lives in the
// bookings feature.
export { BookingsScreen as default } from '@/features/bookings';
// If this screen crashes while rendering, only it shows an error with "Try again"
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/screen-error-boundary';
