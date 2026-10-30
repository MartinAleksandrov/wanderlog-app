import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  test: defineTable(v.object({ name: v.string(), password: v.string() })),
});
