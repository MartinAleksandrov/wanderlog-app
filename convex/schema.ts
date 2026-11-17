import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// Wanderlog's data for the first release. How the tables relate:
//
//   users ──< tripMembers >── trips ──< places
//                               │         ▲ (place items point to a place)
//                               └──< itineraryItems
//
// "A ──< B" means one A has many Bs, and each B stores its A's ID (v.id('a')).
// Convex adds _id and _creationTime to every document automatically.

// A point on the map. Same field names as the map libraries use, so a stored point can be
// passed straight to a map marker.
export const coordinates = v.object({
  latitude: v.number(),
  longitude: v.number(),
});

// What a person may do in the whole app (separate from their role in any one trip).
// Exported so functions check roles against the same list.
//   admin: manage the app: review all data, delete users and their content
//   user:  a regular signed-in person; sees only trips they are a member of
export const appRole = v.union(v.literal('admin'), v.literal('user'));

// What a member may do in a trip. Exported so functions check roles against the same list.
//   owner:  everything, including deleting the trip and managing members
//   editor: add and change places and the itinerary
//   viewer: read only
export const tripRole = v.union(v.literal('owner'), v.literal('editor'), v.literal('viewer'));

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

export default defineSchema({
  // One row per person who has signed in. Clerk owns the account itself (password, email
  // codes); this row is the app's own profile, which trips and places point to.
  users: defineTable({
    // Clerk's user ID ("user_2abc…"), read from the token: ctx.auth.getUserIdentity().subject
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    // New users always start as 'user'. Only an existing admin (or a manual edit in the Convex
    // dashboard) can make someone an admin; the app never sends a role for itself.
    role: appRole,
  }).index('by_clerk_user_id', ['clerkUserId']),

  trips: defineTable({
    name: v.string(),
    // As the user typed it, e.g. "Lisbon, Portugal"
    destination: v.string(),
    // Where the trip map opens before any places are saved
    destinationCoordinates: v.optional(coordinates),
    // Calendar dates as 'YYYY-MM-DD', not timestamps: a trip day is the same date in every
    // time zone
    startDate: v.string(),
    endDate: v.string(),
    notes: v.optional(v.string()),
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
    // Shown in the pin's pop-up
    photoUrl: v.optional(v.string()),
    // The place's ID at the place-search provider (e.g. Google Places), to load more details
    providerPlaceId: v.optional(v.string()),
    notes: v.optional(v.string()),
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
});
