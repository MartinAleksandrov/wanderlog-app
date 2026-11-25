// Route: /trip/<trip ID>/booking, the add/edit booking pop-up. ?type=stay adds a new one,
// ?bookingId=… edits one. Shown as a modal (see the root layout); the screen lives in the
// bookings feature.
export { BookingFormScreen as default } from '@/features/bookings';
// If this screen crashes while rendering, only it shows an error with "Try again"
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/screen-error-boundary';
