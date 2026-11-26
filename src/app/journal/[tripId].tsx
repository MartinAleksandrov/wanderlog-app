// Route: /journal/<trip ID>, a past trip's journal page, opened from the account tab. A full
// screen with a back arrow (see the root layout). The screen lives in the journal feature.
export { JournalScreen as default } from '@/features/journal';
// If this screen crashes while rendering, only it shows an error with "Try again"
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/screen-error-boundary';
