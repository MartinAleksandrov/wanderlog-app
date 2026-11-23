// Route: /add-stops?day=2, the pop-up for adding saved places to a day of the plan. Shown as a
// sheet that slides up over the tabs (see the root layout). The screen lives in the itinerary
// feature.
export { AddStopsSheet as default } from '@/features/itinerary';
// If this screen crashes while rendering, only it shows an error with "Try again"
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/screen-error-boundary';
