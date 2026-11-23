// Route: /plan (fourth tab), the trip day by day. The screen lives in the itinerary feature.
// The map opens a day's route with /map?day=2.
export { PlanScreen as default } from '@/features/itinerary';
// If this screen crashes while rendering, only it shows an error with "Try again"
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/screen-error-boundary';
