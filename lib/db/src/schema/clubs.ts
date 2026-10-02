import { createInsertSchema } from "drizzle-zod";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { collegesTable, departmentsTable, userProfilesTable } from "./campus";

export const clubsTable = pgTable(
  "clubs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => collegesTable.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").references(() => departmentsTable.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("clubs_college_slug_unique").on(table.collegeId, table.slug),
    index("clubs_college_status_idx").on(table.collegeId, table.status),
  ],
);

export const clubMembersTable = pgTable(
  "club_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clubId: uuid("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    membershipRole: text("membership_role").notNull().default("MEMBER"),
    status: text("status").notNull().default("ACTIVE"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("club_members_club_user_unique").on(table.clubId, table.userId),
    index("club_members_user_status_idx").on(table.userId, table.status),
    index("club_members_club_status_idx").on(table.clubId, table.status),
  ],
);

export const insertClubSchema = createInsertSchema(clubsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertClubMemberSchema = createInsertSchema(clubMembersTable).omit(
  { id: true, joinedAt: true, createdAt: true, updatedAt: true },
);

export type Club = typeof clubsTable.$inferSelect;
export type ClubMember = typeof clubMembersTable.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;
export type InsertClubMember = z.infer<typeof insertClubMemberSchema>;