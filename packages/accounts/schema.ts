import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

// The one shared table (public ADR 0013): every other table carries account_id.
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
