import type { AuthConfig } from 'convex/server';

// Tells Convex which sign-in tokens to trust: ones issued by our Clerk app ("domain") and
// addressed to Convex ("applicationID" must match the token's audience claim, "convex").
// CLERK_JWT_ISSUER_DOMAIN is set on the Convex deployment (npx convex env set ...), not in .env.local,
// because this file runs on Convex's servers.
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig;
