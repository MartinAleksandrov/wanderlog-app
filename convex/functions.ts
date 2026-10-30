import { query } from './_generated/server';

export const myQuery = query({
  args: {},
  handler: async (ctx) => {
    const data = await ctx.db.query('test').collect();
    return data;
  },
});
