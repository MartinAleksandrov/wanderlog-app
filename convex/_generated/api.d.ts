/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as bookings from "../bookings.js";
import type * as googlePlaces from "../googlePlaces.js";
import type * as http from "../http.js";
import type * as itinerary from "../itinerary.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_limits from "../lib/limits.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_placeKind from "../lib/placeKind.js";
import type * as places from "../places.js";
import type * as trips from "../trips.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  bookings: typeof bookings;
  googlePlaces: typeof googlePlaces;
  http: typeof http;
  itinerary: typeof itinerary;
  "lib/dates": typeof lib_dates;
  "lib/limits": typeof lib_limits;
  "lib/permissions": typeof lib_permissions;
  "lib/placeKind": typeof lib_placeKind;
  places: typeof places;
  trips: typeof trips;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
