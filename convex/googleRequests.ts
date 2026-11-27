import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { utcDateOf } from './lib/dates';
import { requireUser } from './lib/permissions';
import { googleRequestKind } from './schema';

// Adds `count` (default 1) to the caller's count of Google Places requests of this kind today.
// Called by convex/googlePlaces.ts before requests go to Google, which makes it the gate too:
// requireUser throws for a signed-out or suspended caller, so no request is paid for them.
// Internal: the app can't call it, only our own actions (ctx.runMutation), which pass the
// caller's sign-in along.
export const record = internalMutation({
  args: { kind: googleRequestKind, count: v.optional(v.number()) },
  handler: async (ctx, { kind, count = 1 }) => {
    const user = await requireUser(ctx);
    const day = utcDateOf(Date.now());

    const counter = await ctx.db
      .query('googleRequests')
      .withIndex('by_user_and_day_and_kind', (q) =>
        q.eq('userId', user._id).eq('day', day).eq('kind', kind),
      )
      .unique();
    // Two of these can still run at once on the same row (fast typing in a search box). Convex runs
    // mutations as if one after another (it retries one that read a row another just changed), so
    // no count is lost.
    if (counter === null) {
      await ctx.db.insert('googleRequests', { userId: user._id, day, kind, count });
    } else {
      await ctx.db.patch('googleRequests', counter._id, { count: counter.count + count });
    }
  },
});
