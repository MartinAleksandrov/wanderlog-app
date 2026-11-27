import { defineSchema, defineTable } from 'convex/server';
import { v, type Infer } from 'convex/values';

// Wandr's data for the first release. How the tables relate:
//
//   users ──< tripMembers >── trips ──< places
//     │                         │         ▲ (place items point to a place)
//     ├──< devices              ├──< itineraryItems
//     └──< googleRequests       └──< bookings (hotels, flights, transport, activities)
//
// "A ──< B" means one A has many Bs, and each B stores its A's ID (v.id('a')).
// Convex adds _id and _creationTime to every document automatically.

// A point on the map. Same field names as the map libraries use, so a stored point can be
// passed straight to a map marker.
export const coordinates = v.object({
  latitude: v.number(),
  longitude: v.number(),
});
export type Coordinates = Infer<typeof coordinates>;

// The app's three sides, each with its own suggestions and its own saved list per trip:
//   sight      = places to visit (museums, landmarks, parks…)
//   sweet      = sweet spots (bakeries, cafes, brunch, desserts)
//   restaurant = restaurants (sit-down meals, any cuisine)
export const placeKind = v.union(v.literal('sight'), v.literal('sweet'), v.literal('restaurant'));
export type PlaceKind = Infer<typeof placeKind>;

// What a person may do in the whole app (separate from their role in any one trip). Functions
// read the type from the table, e.g. Doc<'users'>['role'].
//   admin: everything a user can, plus the dashboard (convex/admin.ts): every user's usage,
//          and suspending users or deleting their data
//   user:  a regular signed-in person; sees only trips they are a member of
const appRole = v.union(v.literal('admin'), v.literal('user'));

// The phone the app runs on, as the app reports it on each start (src/lib/device-info.ts).
// Android: model 'SM-S921B', manufacturer 'samsung', osVersion 'Android 16'.
export const deviceInfo = v.object({
  platform: v.string(),
  model: v.string(),
  manufacturer: v.optional(v.string()),
  osVersion: v.string(),
  // Wandr's version, from app.config.ts
  appVersion: v.optional(v.string()),
});
export type DeviceInfo = Infer<typeof deviceInfo>;

// Which kind of Google Places request it was. Google bills each kind at its own price:
//   autocomplete = search suggestions while typing (cities, stays, the map's search bar)
//   details      = one place's details (a picked city or stay, the details sheet)
//   nearby       = the places, sweet spots and restaurants around the map's area
//   textSearch   = "places matching a word" from the map's search bar
export const googleRequestKind = v.union(
  v.literal('autocomplete'),
  v.literal('details'),
  v.literal('nearby'),
  v.literal('textSearch'),
);
export type GoogleRequestKind = Infer<typeof googleRequestKind>;

// What a member may do in a trip (see convex/lib/permissions.ts, which ranks them)
//   owner:  everything, including deleting the trip and managing members
//   editor: add and change places and the itinerary
//   viewer: read only
const tripRole = v.union(v.literal('owner'), v.literal('editor'), v.literal('viewer'));

// Fields shared by both kinds of itinerary item
const itineraryItemBase = {
  tripId: v.id('trips'),
  // 1 = the trip's first day. A day number instead of a date, so changing the trip's dates
  // moves the whole plan along with them.
  day: v.number(),
  // Position within the day. Fractions let an item be dropped between two others
  // (between 1 and 2 -> 1.5) without renumbering the rest.
  order: v.number(),
};

// A booking's price. Whole cents (12550 = 125.50), not a decimal: decimals drift in JavaScript
// (0.1 + 0.2 is 0.30000000000000004), and sums of prices have to be exact. The currency is an
// ISO 4217 code such as 'EUR'.
export const money = v.object({ amountCents: v.number(), currency: v.string() });
export type Money = Infer<typeof money>;

// How a transport booking travels. 'car' is a rental car: picked up at the start, returned at
// the end.
export const transportMode = v.union(
  v.literal('train'),
  v.literal('bus'),
  v.literal('ferry'),
  v.literal('car'),
  v.literal('other'),
);
export type TransportMode = Infer<typeof transportMode>;

// Fields every booking has. Dates and times are local, as printed on the ticket or the booking
// confirmation, with no time zone: a flight leaves on the origin's clock and lands on the
// destination's. Dates (not trip day numbers like the plan): a booking is for a real day, and
// stays on it when the trip's dates change.
const bookingBase = {
  // 'YYYY-MM-DD'. Check-in, departure, pick-up, or when an activity starts.
  startDate: v.string(),
  // 'HH:mm', optional: a check-in time isn't always known
  startTime: v.optional(v.string()),
  endTime: v.optional(v.string()),
  // The booking reference to show at the desk or the gate
  confirmationCode: v.optional(v.string()),
  price: v.optional(money),
  notes: v.optional(v.string()),
};

// What each type of booking has on top of the base. `type` tells them apart, so TypeScript knows
// which fields a booking has once its type is checked.
const stayFields = {
  type: v.literal('stay'),
  // The hotel or apartment
  name: v.string(),
  address: v.optional(v.string()),
  // Filled in when it was picked from Google's search; missing when typed by hand
  coordinates: v.optional(coordinates),
  providerPlaceId: v.optional(v.string()),
  phone: v.optional(v.string()),
  website: v.optional(v.string()),
  // Check-out. Required: a stay always ends.
  endDate: v.string(),
};
const flightFields = {
  type: v.literal('flight'),
  // As on the boarding pass, e.g. 'LH 1234'
  flightNumber: v.string(),
  airline: v.optional(v.string()),
  // Airports or cities, e.g. 'SOF' or 'Sofia'
  from: v.string(),
  to: v.string(),
  // Arrival
  endDate: v.optional(v.string()),
  terminal: v.optional(v.string()),
  seat: v.optional(v.string()),
};
const transportFields = {
  type: v.literal('transport'),
  mode: transportMode,
  // The company or the train/bus number, e.g. 'Eurostar 9014' or 'Avis'
  name: v.string(),
  // Stations, or a rental car's pick-up and drop-off
  from: v.optional(v.string()),
  to: v.optional(v.string()),
  // Arrival, or when a rental car goes back
  endDate: v.optional(v.string()),
};
const activityFields = {
  type: v.literal('activity'),
  // Tickets, a tour, a restaurant table: 'Sagrada Família tickets'
  name: v.string(),
  address: v.optional(v.string()),
  endDate: v.optional(v.string()),
};

// A booking as the app sends it to bookings.create and bookings.update: everything except which
// trip it's in and who added it, which the backend sets itself.
export const bookingInput = v.union(
  v.object({ ...bookingBase, ...stayFields }),
  v.object({ ...bookingBase, ...flightFields }),
  v.object({ ...bookingBase, ...transportFields }),
  v.object({ ...bookingBase, ...activityFields }),
);
export type BookingInput = Infer<typeof bookingInput>;
export type BookingType = BookingInput['type'];

// The stored booking: the same, plus its trip and who added it
const bookingOwner = { tripId: v.id('trips'), addedBy: v.id('users') };

export default defineSchema({
  // One row per person who has signed in. Clerk owns the account itself (password, email
  // codes); this row is the app's own profile, which trips and places point to.
  users: defineTable({
    // Clerk's user ID ("user_2abc…"), read from the token: ctx.auth.getUserIdentity().subject
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    // New users always start as 'user'. Only a manual edit in the Convex dashboard (Data → users)
    // makes someone an admin; the app never sends a role for itself.
    role: appRole,
    // The trip the map and places tabs show. Kept on the server, so it's the same on every
    // device. May point to a deleted trip; functions then fall back to the newest trip.
    activeTripId: v.optional(v.id('trips')),
    // When an admin suspended the account. While set, every function treats the person as
    // signed out (see convex/lib/permissions.ts) and the app shows "Your account was suspended".
    // The row itself stays: deleted, it would be created again on the next sign-in.
    suspendedAt: v.optional(v.number()),
    // When an admin deleted the person's trips and devices (the account stays suspended)
    dataDeletedAt: v.optional(v.number()),
    // No "last seen" here: every query reads this row, so a change to it re-runs all of the
    // user's live queries. Last seen is on their devices instead.
  }).index('by_clerk_user_id', ['clerkUserId']),

  // The phones someone has used the app on. One row per user and phone model: an OS update or a
  // reinstall updates the same row. Written by users.store on every app start and every return
  // to the foreground; read only by the admin dashboard.
  devices: defineTable({
    userId: v.id('users'),
    ...deviceInfo.fields,
    lastSeenAt: v.number(),
  })
    // "This user's devices", and with the model: "this user's row for this phone"
    .index('by_user_and_platform_and_model', ['userId', 'platform', 'model']),

  // How many Google Places requests each user made, per day and kind. One row per user, day and
  // kind with a running count rather than one row per request, so the table stays small.
  // Counted in convex/googlePlaces.ts before each request goes out.
  googleRequests: defineTable({
    userId: v.id('users'),
    // 'YYYY-MM-DD' in UTC
    day: v.string(),
    kind: googleRequestKind,
    count: v.number(),
  })
    // One user's counts (by day), and the row to add one to
    .index('by_user_and_day_and_kind', ['userId', 'day', 'kind'])
    // Everyone's counts for the last few days (the dashboard's chart)
    .index('by_day', ['day']),

  trips: defineTable({
    name: v.string(),
    // As the user typed it, e.g. "Lisbon, Portugal"
    destination: v.string(),
    // Where the trip map opens before any places are saved
    destinationCoordinates: v.optional(coordinates),
    // Google photo name of the destination, the trip card's cover image (see convex/http.ts)
    destinationPhotoName: v.optional(v.string()),
    // Calendar dates as 'YYYY-MM-DD', not timestamps: a trip day is the same date in every
    // time zone
    startDate: v.string(),
    endDate: v.string(),
    // Planning notes (bookings, ideas, what to pack), from the edit-trip screen
    notes: v.optional(v.string()),
    // The travel journal, written after the trip (or during it): how the city was overall.
    // Separate from `notes`, which are for planning.
    journal: v.optional(v.string()),
    // The city's stars in the journal, 1 to 5
    rating: v.optional(v.number()),
  }),

  // Who can open which trip, and with what role. The only place access is stored (the owner
  // too), so every permission check is a single lookup in this table.
  tripMembers: defineTable({
    tripId: v.id('trips'),
    userId: v.id('users'),
    role: tripRole,
  })
    // "Is this user in this trip, and as what?" By tripId alone: "who is in this trip?"
    .index('by_trip_and_user', ['tripId', 'userId'])
    // "Which trips is this user in?" (the trips list)
    .index('by_user', ['userId']),

  // Places saved to a trip: the pins on the trip map. A place can be scheduled on the
  // itinerary, or just kept on the trip's "places to visit" list.
  places: defineTable({
    tripId: v.id('trips'),
    addedBy: v.id('users'),
    name: v.string(),
    coordinates,
    address: v.optional(v.string()),
    // Google photo name ("places/…/photos/…"), shown on the pin and in the places list. A name,
    // not a URL: the app turns it into an image URL through our backend (see convex/http.ts),
    // so the Google API key never ships inside the app.
    photoName: v.optional(v.string()),
    // What kind of place it is, e.g. "Museum"
    category: v.optional(v.string()),
    // Which list it was saved to. Missing on places saved before sweet spots existed: 'sight'.
    kind: v.optional(placeKind),
    // The place's ID at the place-search provider (e.g. Google Places), to load more details
    providerPlaceId: v.optional(v.string()),
    // The travel journal's note about this place, and its stars (1 to 5)
    notes: v.optional(v.string()),
    rating: v.optional(v.number()),
  }).index('by_trip', ['tripId']),

  // The day-by-day plan. Each item is either a saved place or a free-text note; `kind` says
  // which, and TypeScript then knows which fields the item has.
  itineraryItems: defineTable(
    v.union(
      v.object({
        ...itineraryItemBase,
        kind: v.literal('place'),
        placeId: v.id('places'),
        // Optional planned time, 'HH:mm'
        startTime: v.optional(v.string()),
        // Ticked off on the day ("been there"): the plan's next stop is the first one not done
        done: v.optional(v.boolean()),
      }),
      v.object({
        ...itineraryItemBase,
        kind: v.literal('note'),
        text: v.string(),
      }),
    ),
  )
    // A trip's whole plan in display order: by day, then by position within the day
    .index('by_trip_and_day_and_order', ['tripId', 'day', 'order'])
    // A place's itinerary entries, to remove them when the place is deleted
    .index('by_place', ['placeId']),

  // Reservations made for a trip: where you sleep, how you get there and around, and tickets.
  // Each row is one of four types (see bookingInput above).
  bookings: defineTable(
    v.union(
      v.object({ ...bookingOwner, ...bookingBase, ...stayFields }),
      v.object({ ...bookingOwner, ...bookingBase, ...flightFields }),
      v.object({ ...bookingOwner, ...bookingBase, ...transportFields }),
      v.object({ ...bookingOwner, ...bookingBase, ...activityFields }),
    ),
  )
    // A trip's bookings in time order. A missing start time sorts first in its day.
    .index('by_trip_and_start', ['tripId', 'startDate', 'startTime']),
});
