# Known issues

Problems found in reviews and left for later on purpose. Each one names where it is, what goes
wrong, and the fix we have in mind. Delete an entry in the PR that fixes it.

From the review of the admin dashboard PR (`feat/admin-dashboard`, November 2026):

## Suspended cover may sit under an open sheet or modal

- **Where:** `src/app/_layout.tsx` (`RootNavigator`), `src/features/auth/components/suspended-screen.tsx`
- **What happens:** the "Your account was suspended" cover is a JS view drawn after the native
  Stack. A screen shown as a `formSheet` or `modal` (place details, add stops, new trip, booking)
  may be drawn above it by react-native-screens, so a user suspended while one is open still sees
  it and can tap it. Its actions fail ("Your account was suspended."), so no data changes.
  Likely on iOS; not tested on either platform yet.
- **Fix:** first reproduce on the emulator (open a place sheet, suspend the account from another
  device). If it shows, close open sheets when `suspended` turns true (`router.dismissAll()`),
  or move suspension into the `Stack.Protected` guards with its own route.

## TalkBack can reach the screens under the suspended cover

- **Where:** `src/features/auth/components/suspended-screen.tsx`
- **What happens:** `accessibilityViewIsModal` only works on iOS. On Android a screen reader can
  still move to the tabs and cards behind the cover. (The backend refuses everything anyway.)
- **Fix:** while suspended, give the Stack's wrapper `importantForAccessibility="no-hide-descendants"`.

## Photo route has no sign-in, so suspension can't stop it

- **Where:** `convex/http.ts` (`/place-photo`)
- **What happens:** anyone with the deployment's `.convex.site` URL, suspended or not, can call
  the route and make the backend pay for Google photo lookups. These calls aren't counted on the
  dashboard either. Older than the dashboard; the route is used by `<Image>`, which can't send
  the Clerk token.
- **Fix:** sign the photo URLs (an HMAC of the photo name and an expiry, made by the query that
  returns the photo name, checked by the route), or rate-limit the route per IP.

## Dashboard: request chart drops the newest days past 2,000 counter rows

- **Where:** `convex/admin.ts` (`dashboard`, the `googleRequests` read)
- **What happens:** the last 7 days of counters are read oldest first with
  `.take(ADMIN_COUNT_LIMIT)`. Past 2,000 rows (about 70 users using every kind of search every
  day), today's numbers are the ones cut off, with no "2,000+" shown.
- **Fix:** read one bounded `by_day` range per chart day, or `.order('desc')`, and show when the
  limit was reached.

## Dashboard: active users, last seen and trip counts past 2,000 rows

- **Where:** `convex/admin.ts` (`dashboard`, the `devices` and `tripMembers` reads)
- **What happens:** both tables are read with `.take(ADMIN_COUNT_LIMIT)`, oldest first. Past
  2,000 rows the newest users show "Not seen yet · 0 trips" and are missing from the active
  counts. Only the users and content tiles say "2,000+".
- **Fix:** look up devices and memberships per user (both have indexes that start with the user),
  or keep running counts with the Convex aggregate component once the app has that many users.

## Dashboard: the Users list draws every row at once

- **Where:** `src/features/admin/components/users-section.tsx`
- **What happens:** opening the card mounts a row and an avatar per user (up to 2,000) inside a
  ScrollView, and re-renders them on every live update. Fine for tens of users, slow for
  thousands.
- **Fix:** a `FlatList`, or the first 50 rows with "Show more".
