import { createInsertSchema } from "drizzle-zod";
import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { collegesTable, userProfilesTable } from "./campus";
import { eventsTable } from "./events";

export const tasksTable = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    assigneeId: uuid("assignee_id").references(() => userProfilesTable.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    status: text("status").notNull().default("OPEN"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("tasks_event_status_idx").on(table.eventId, table.status),
    index("tasks_assignee_status_idx").on(table.assigneeId, table.status),
  ],
);

export const volunteerAssignmentsTable = pgTable(
  "volunteer_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    volunteerId: uuid("volunteer_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasksTable.id, {
      onDelete: "set null",
    }),
    dutyRole: text("duty_role").notNull().default("VOLUNTEER"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    status: text("status").notNull().default("ASSIGNED"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("volunteer_assignments_event_user_task_unique").on(
      table.eventId,
      table.volunteerId,
      table.taskId,
    ),
    index("volunteer_assignments_volunteer_status_idx").on(
      table.volunteerId,
      table.status,
    ),
    index("volunteer_assignments_event_idx").on(table.eventId),
  ],
);

export const budgetsTable = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    allocatedAmount: numeric("allocated_amount", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull().default("DRAFT"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("budgets_event_unique").on(table.eventId),
    index("budgets_status_idx").on(table.status),
  ],
);

export const expensesTable = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => budgetsTable.id, { onDelete: "cascade" }),
    submittedBy: uuid("submitted_by")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "restrict" }),
    category: text("category").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    description: text("description").notNull(),
    receiptObjectKey: text("receipt_object_key"),
    status: text("status").notNull().default("SUBMITTED"),
    spentAt: timestamp("spent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("expenses_budget_status_idx").on(table.budgetId, table.status),
    index("expenses_submitter_created_idx").on(
      table.submittedBy,
      table.createdAt,
    ),
  ],
);

export const feedbackTable = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    comment: text("comment"),
    status: text("status").notNull().default("VISIBLE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("feedback_event_user_unique").on(table.eventId, table.userId),
    index("feedback_event_created_idx").on(table.eventId, table.createdAt),
  ],
);

export const certificatesTable = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    certificateType: text("certificate_type").notNull().default("PARTICIPATION"),
    status: text("status").notNull().default("PENDING"),
    fileObjectKey: text("file_object_key"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("certificates_event_recipient_unique").on(
      table.eventId,
      table.recipientId,
    ),
    index("certificates_recipient_status_idx").on(
      table.recipientId,
      table.status,
    ),
  ],
);

export const notificationsTable = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    category: text("category").notNull().default("GENERAL"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_recipient_created_idx").on(
      table.recipientId,
      table.createdAt,
    ),
    index("notifications_unread_idx").on(table.recipientId, table.readAt),
  ],
);

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collegeId: uuid("college_id").references(() => collegesTable.id, {
      onDelete: "set null",
    }),
    actorId: uuid("actor_id").references(() => userProfilesTable.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_college_created_idx").on(
      table.collegeId,
      table.createdAt,
    ),
    index("audit_logs_actor_created_idx").on(table.actorId, table.createdAt),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertVolunteerAssignmentSchema = createInsertSchema(
  volunteerAssignmentsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBudgetSchema = createInsertSchema(budgetsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertExpenseSchema = createInsertSchema(expensesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertFeedbackSchema = createInsertSchema(feedbackTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({ rating: z.number().int().min(1).max(5) });
export const insertCertificateSchema = createInsertSchema(
  certificatesTable,
).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(
  notificationsTable,
).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({
  id: true,
  createdAt: true,
});

export type Task = typeof tasksTable.$inferSelect;
export type VolunteerAssignment = typeof volunteerAssignmentsTable.$inferSelect;
export type Budget = typeof budgetsTable.$inferSelect;
export type Expense = typeof expensesTable.$inferSelect;
export type Feedback = typeof feedbackTable.$inferSelect;
export type Certificate = typeof certificatesTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertVolunteerAssignment = z.infer<
  typeof insertVolunteerAssignmentSchema
>;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;