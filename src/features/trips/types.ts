import type { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';

// One trip as the home screen gets it from the backend (trips.list): the trip, the user's role
// and the number of saved places. Derived from the function, so it can't drift from the backend.
export type TripSummary = FunctionReturnType<typeof api.trips.list>[number];
