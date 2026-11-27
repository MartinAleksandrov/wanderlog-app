import { internalMutation } from './_generated/server';
import { toLatin } from './lib/latin';

// One-off fixes to data saved before a change, run by hand:
//   npx convex run migrations:latinPlaceText          (dev)
//   npx convex run --prod migrations:latinPlaceText   (production, after `npx convex deploy`)
// Internal, so the app can't call them. Delete each one once it has run on both.

// Google names and addresses saved while they still came in Cyrillic ("Старинен Пловдив"),
// spelled in Latin letters like new ones are (see lib/latin.ts). Places and stays picked from
// Google only; running it twice changes nothing. Returns how many rows it changed.
export const latinPlaceText = internalMutation({
  args: {},
  handler: async (ctx) => {
    const [places, bookings] = await Promise.all([
      ctx.db.query('places').collect(),
      ctx.db.query('bookings').collect(),
    ]);
    const patches = [
      ...places.flatMap((place) => {
        const fields = latinFields(place);
        return fields ? [ctx.db.patch('places', place._id, fields)] : [];
      }),
      ...bookings.flatMap((booking) => {
        const fields = booking.type === 'stay' ? latinFields(booking) : null;
        return fields ? [ctx.db.patch('bookings', booking._id, fields)] : [];
      }),
    ];
    await Promise.all(patches);
    return patches.length;
  },
});

// A row's name and address in Latin letters, or null when it didn't come from Google or nothing
// changes
function latinFields(row: { name: string; address?: string; providerPlaceId?: string }) {
  if (!row.providerPlaceId) return null;
  const name = toLatin(row.name);
  const address = row.address && toLatin(row.address);
  return name === row.name && address === row.address ? null : { name, address };
}
