import { createInsertSchema } from "drizzle-zod";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import {
  collegesTable,
  departmentsTable,
  eventStatusEnum,
  userProfilesTable,
} from "./campus";
import { clubsTable } from "./clubs";

export const eventsTable = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => collegesTable.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").references(() => departmentsTable.id, {
      onDelete: "set null",
    }),
    clubId: uuid("club_id").references(() => clubsTable.id, {
      onDelete: "set null",
    }),
    organizerId: uuid("organizer_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    category: text("category").notNull().default("OTHER"),
    description: text("description"),
    status: eventStatusEnum("status").notNull().default("DRAFT"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    venue: text("venue").notNull(),
    capacity: integer("capacity"),
    registrationDeadline: timestamp("registration_deadline", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("events_college_status_start_idx").on(
      table.collegeId,
      table.status,
      table.startsAt,
    ),
    index("events_organizer_start_idx").on(table.organizerId, table.startsAt),
    index("events_club_start_idx").on(table.clubId, table.startsAt),
    index("events_department_start_idx").on(table.departmentId, table.startsAt),
  ],
);

export const eventRegistrationsTable = pgTable(
  "event_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("REGISTERED"),
    registeredAt: timestamp("registered_at", { withTimezone: true })
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
    uniqueIndex("event_registrations_event_student_unique").on(
      table.eventId,
      table.studentId,
    ),
    index("event_registrations_student_status_idx").on(
      table.studentId,
      table.status,
    ),
  ],
);

export const attendanceTable = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => eventRegistrationsTable.id, { onDelete: "cascade" }),
    checkedInBy: uuid("checked_in_by").references(() => userProfilesTable.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("PRESENT"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("attendance_registration_unique").on(table.registrationId),
    index("attendance_checked_in_at_idx").on(table.checkedInAt),
  ],
);

export const insertEventSchema = createInsertSchema(eventsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertEventRegistrationSchema = createInsertSchema(
  eventRegistrationsTable,
).omit({ id: true, registeredAt: true, createdAt: true, updatedAt: true });
export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({
  id: true,
  checkedInAt: true,
  createdAt: true,
});

export type Event = typeof eventsTable.$inferSelect;
export type EventRegistration = typeof eventRegistrationsTable.$inferSelect;
export type Attendance = typeof attendanceTable.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type InsertEventRegistration = z.infer<
  typeof insertEventRegistrationSchema
>;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;