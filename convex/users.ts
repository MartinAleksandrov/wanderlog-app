import { mutation, query } from './_generated/server';
import { getCurrentUser, requireUser } from './lib/permissions';

// Creates the signed-in person's users row. The app calls it right after sign-in, so queries
// find the row from the start. Safe to call again: it returns the existing row's ID.
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return user._id;
  },
});

// The account screen's data from our backend: the app role and how many trips the user is in.
// Name, email and photo come from Clerk on the device, which always has the latest values.
// null while signed out or before `store` has run.
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return null;

    const memberships = await ctx.db
      .query('tripMembers')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();
    return { role: user.role, tripCount: memberships.length };
  },
});
