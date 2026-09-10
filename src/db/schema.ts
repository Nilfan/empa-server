import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordHashVersion: integer("password_hash_version").notNull().default(1),
  salt: text("salt").notNull(),
  roles: text("roles").array().notNull().default([]),
});

export const sessions = pgTable(
  "sessions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ownerId: bigint("owner_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: jsonb("content").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isRegular: boolean("is_regular").notNull().default(false),
    regularConfig: jsonb("regular_config"),
  },
  (table) => [
    index("calendar_events_owner_id_start_at_idx").on(
      table.ownerId,
      table.startAt,
    ),
  ],
);

export const calendarSharing = pgTable("calendar_sharing", {
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  sharedWith: bigint("shared_with", { mode: "number" }).array().notNull(),
});
