import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const appRoleEnum = pgEnum("app_role", [
  "COLLEGE_ADMIN",
  "CLUB",
  "ORGANIZER",
  "STUDENT",
  "VOLUNTEER",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "PUBLISHED",
  "COMPLETED",
  "CANCELLED",
]);

export const rolesTable = pgTable("roles", {
  roleKey: appRoleEnum("role_key").primaryKey(),
  displayName: text("display_name").notNull(),
  scope: text("scope").notNull(),
  description: text("description").notNull(),
});

export const collegesTable = pgTable(
  "colleges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
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
    uniqueIndex("colleges_slug_unique").on(table.slug),
    index("colleges_status_idx").on(table.status),
  ],
);

export const departmentsTable = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => collegesTable.id, { onDelete: "cascade" }),
    code: text("code"),
    name: text("name").notNull(),
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
    uniqueIndex("departments_college_name_unique").on(
      table.collegeId,
      table.name,
    ),
    index("departments_college_idx").on(table.collegeId),
  ],
);

export const userProfilesTable = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authUserId: text("auth_user_id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    roleKey: appRoleEnum("role_key")
      .notNull()
      .default("STUDENT")
      .references(() => rolesTable.roleKey, { onDelete: "restrict" }),
    collegeId: uuid("college_id").references(() => collegesTable.id, {
      onDelete: "set null",
    }),
    departmentId: uuid("department_id").references(() => departmentsTable.id, {
      onDelete: "set null",
    }),
    departmentName: text("department_name"),
    phone: text("phone"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("user_profiles_auth_user_id_unique").on(table.authUserId),
    uniqueIndex("user_profiles_email_unique").on(table.email),
    index("user_profiles_role_college_idx").on(table.roleKey, table.collegeId),
    index("user_profiles_department_idx").on(table.departmentId),
  ],
);

export const insertCollegeSchema = createInsertSchema(collegesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertDepartmentSchema = createInsertSchema(departmentsTable).omit(
  { id: true, createdAt: true, updatedAt: true },
);
export const insertUserProfileSchema = createInsertSchema(userProfilesTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({ roleKey: z.enum(appRoleEnum.enumValues) });

export type AppRole = (typeof appRoleEnum.enumValues)[number];
export type College = typeof collegesTable.$inferSelect;
export type Department = typeof departmentsTable.$inferSelect;
export type UserProfile = typeof userProfilesTable.$inferSelect;
export type InsertCollege = z.infer<typeof insertCollegeSchema>;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;