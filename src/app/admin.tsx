// Route: /admin, the admin dashboard, opened from the account tab (admins only; the backend
// sends nothing to anyone else). A full screen with a back arrow (see the root layout). The
// screen lives in the admin feature.
export { AdminDashboardScreen as default } from '@/features/admin';
// If this screen crashes while rendering, only it shows an error with "Try again"
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/screen-error-boundary';
