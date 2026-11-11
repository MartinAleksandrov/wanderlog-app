import { query } from './_generated/server';

// "Who am I?" from the backend's point of view. Convex verifies the Clerk token that came with
// the request; if it's valid, ctx.auth knows the user. Returns null for signed-out callers.
// The app uses it to prove the whole chain works: Clerk sign-in -> token -> Convex trusts it.
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) return null;

    return {
      // Clerk's user ID (e.g. "user_2abc..."): the stable key we'll attach trips to later
      clerkUserId: identity.subject,
      email: identity.email ?? null,
      name: identity.name ?? null,
    };
  },
});
