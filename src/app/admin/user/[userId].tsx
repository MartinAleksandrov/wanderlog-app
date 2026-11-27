// Route: /admin/user/<user ID>, one person's page on the admin dashboard, opened from its users
// list. A full screen with a back arrow (see the root layout); it sets the person's name as its
// title. The screen lives in the admin feature.
export { AdminUserScreen as default } from '@/features/admin';
// If this screen crashes while rendering, only it shows an error with "Try again"
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/screen-error-boundary';
