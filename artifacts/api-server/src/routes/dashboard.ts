import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import { Router, type IRouter } from "express";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import {
  auditLogsTable,
  attendanceTable,
  budgetsTable,
  certificatesTable,
  clubMembersTable,
  clubsTable,
  collegesTable,
  db,
  eventRegistrationsTable,
  eventsTable,
  expensesTable,
  feedbackTable,
  tasksTable,
  userProfilesTable,
  volunteerAssignmentsTable,
  type AppRole,
  type UserProfile,
} from "@workspace/db";
import { requireAuthenticatedProfile } from "../middlewares/authorization";

const router: IRouter = Router();

async function countRows<TTable extends AnyPgTable>(
  table: TTable,
  where: SQL<unknown>,
): Promise<number> {
  // All callers pass a statically imported PostgreSQL table; this query only
  // selects COUNT(*), so the cast does not affect runtime SQL or returned data.
  const [row] = await db
    .select({ total: count() })
    .from(table as unknown as typeof eventsTable)
    .where(where);
  return Number(row?.total ?? 0);
}

function metric(
  key: string,
  label: string,
  value: number,
  helper: string,
  tone: "neutral" | "accent" | "success" | "warning" = "neutral",
) {
  return { key, label, value, helper, tone };
}

async function getClubIds(profile: UserProfile): Promise<string[]> {
  if (!profile.collegeId) return [];
  const rows = await db
    .select({ id: clubMembersTable.clubId })
    .from(clubMembersTable)
    .innerJoin(clubsTable, eq(clubMembersTable.clubId, clubsTable.id))
    .where(
      and(
        eq(clubMembersTable.userId, profile.id),
        eq(clubMembersTable.status, "ACTIVE"),
        eq(clubsTable.collegeId, profile.collegeId),
      ),
    );
  return rows.map((row) => row.id);
}

async function eventRows(where: SQL<unknown>) {
  return db
    .select({
      id: eventsTable.id,
      title: eventsTable.title,
      category: eventsTable.category,
      startAt: eventsTable.startsAt,
      venue: eventsTable.venue,
      status: eventsTable.status,
    })
    .from(eventsTable)
    .where(where)
    .orderBy(asc(eventsTable.startsAt))
    .limit(4);
}

async function buildDashboard(profile: UserProfile) {
  const now = new Date();
  let metrics: ReturnType<typeof metric>[] = [];
  let events: Awaited<ReturnType<typeof eventRows>> = [];
  let activity: {
    id: string;
    title: string;
    detail: string;
    occurredAt: Date;
  }[] = [];

  if (profile.roleKey === "COLLEGE_ADMIN") {
    const scope = profile.collegeId
      ? eq(eventsTable.collegeId, profile.collegeId)
      : sql`false`;
    const clubScope = profile.collegeId
      ? eq(clubsTable.collegeId, profile.collegeId)
      : sql`false`;
    const eventIds = db
      .select({ id: eventsTable.id })
      .from(eventsTable)
      .where(scope);
    const [eventTotal, pending, registrations, clubs, budgets, certificates] =
      await Promise.all([
        countRows(eventsTable, scope),
        countRows(
          eventsTable,
          and(scope, eq(eventsTable.status, "SUBMITTED"))!,
        ),
        countRows(
          eventRegistrationsTable,
          inArray(eventRegistrationsTable.eventId, eventIds),
        ),
        countRows(clubsTable, clubScope),
        countRows(
          budgetsTable,
          inArray(budgetsTable.eventId, eventIds),
        ),
        countRows(
          certificatesTable,
          inArray(certificatesTable.eventId, eventIds),
        ),
      ]);
    metrics = [
      metric("events", "Total events", eventTotal, "Across your campus", "accent"),
      metric("approvals", "Pending approvals", pending, "Waiting for review", pending ? "warning" : "success"),
      metric("registrations", "Registrations", registrations, "Campus-wide total"),
      metric("clubs", "Clubs", clubs, "Active campus clubs"),
      metric("finance", "Finance records", budgets, "Event budgets created"),
      metric("certificates", "Certificates", certificates, "Issued or in progress"),
    ];
    events = profile.collegeId ? await eventRows(scope) : [];
    if (profile.collegeId) {
      const [rows] = await Promise.all([
        db
          .select({
            id: auditLogsTable.id,
            title: auditLogsTable.action,
            detail: auditLogsTable.entityType,
            occurredAt: auditLogsTable.createdAt,
          })
          .from(auditLogsTable)
          .where(eq(auditLogsTable.collegeId, profile.collegeId))
          .orderBy(desc(auditLogsTable.createdAt))
          .limit(5),
      ]);
      activity = rows;
    }
  } else if (profile.roleKey === "CLUB") {
    const clubIds = await getClubIds(profile);
    if (clubIds.length > 0) {
      const clubScope = inArray(eventsTable.clubId, clubIds);
      const memberScope = inArray(clubMembersTable.clubId, clubIds);
      const eventIds = db
        .select({ id: eventsTable.id })
        .from(eventsTable)
        .where(clubScope);
      const [clubEvents, members, organizers] = await Promise.all([
        countRows(eventsTable, clubScope),
        countRows(clubMembersTable, and(memberScope, eq(clubMembersTable.status, "ACTIVE"))!),
        countRows(
          clubMembersTable,
          and(
            memberScope,
            eq(clubMembersTable.status, "ACTIVE"),
            eq(clubMembersTable.membershipRole, "ORGANIZER"),
          )!,
        ),
      ]);
      metrics = [
        metric("events", "Club events", clubEvents, "Within your club", "accent"),
        metric("members", "Members", members, "Active club members"),
        metric("organizers", "Organizers", organizers, "On your club team"),
        metric("templates", "Templates", 0, "Available in a later phase"),
        metric("analytics", "Analytics", 0, "Available in a later phase"),
      ];
      events = await eventRows(clubScope);
      const [rows] = await Promise.all([
        db
          .select({
            id: auditLogsTable.id,
            title: auditLogsTable.action,
            detail: auditLogsTable.entityType,
            occurredAt: auditLogsTable.createdAt,
          })
          .from(auditLogsTable)
          .where(
            and(
              inArray(auditLogsTable.entityId, eventIds),
              eq(auditLogsTable.actorId, profile.id),
            ),
          )
          .orderBy(desc(auditLogsTable.createdAt))
          .limit(5),
      ]);
      activity = rows;
    }
  } else if (profile.roleKey === "ORGANIZER") {
    const eventScope = eq(eventsTable.organizerId, profile.id);
    const eventIds = db
      .select({ id: eventsTable.id })
      .from(eventsTable)
      .where(eventScope);
    const [myEvents, registrations, attendance, volunteers, tasks, budgets] =
      await Promise.all([
        countRows(eventsTable, eventScope),
        countRows(
          eventRegistrationsTable,
          inArray(eventRegistrationsTable.eventId, eventIds),
        ),
        countRows(
          attendanceTable,
          inArray(
            attendanceTable.registrationId,
            db
              .select({ id: eventRegistrationsTable.id })
              .from(eventRegistrationsTable)
              .where(inArray(eventRegistrationsTable.eventId, eventIds)),
          ),
        ),
        countRows(
          volunteerAssignmentsTable,
          inArray(volunteerAssignmentsTable.eventId, eventIds),
        ),
        countRows(tasksTable, inArray(tasksTable.eventId, eventIds)),
        countRows(budgetsTable, inArray(budgetsTable.eventId, eventIds)),
      ]);
    metrics = [
      metric("events", "My events", myEvents, "Events you organize", "accent"),
      metric("registrations", "Registrations", registrations, "Across your events"),
      metric("attendance", "Check-ins", attendance, "Recorded attendance"),
      metric("volunteers", "Volunteers", volunteers, "Assigned to your events"),
      metric("tasks", "Tasks", tasks, "Across your event teams"),
      metric("finance", "Budgets", budgets, "Event budgets"),
    ];
    events = await eventRows(eventScope);
    const [rows] = await Promise.all([
      db
        .select({
          id: auditLogsTable.id,
          title: auditLogsTable.action,
          detail: auditLogsTable.entityType,
          occurredAt: auditLogsTable.createdAt,
        })
        .from(auditLogsTable)
        .where(eq(auditLogsTable.actorId, profile.id))
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(5),
    ]);
    activity = rows;
  } else if (profile.roleKey === "STUDENT") {
    const registrationsScope = eq(eventRegistrationsTable.studentId, profile.id);
    const registrations = db
      .select({ id: eventRegistrationsTable.id })
      .from(eventRegistrationsTable)
      .where(registrationsScope);
    const eventScope = profile.collegeId
      ? and(
          eq(eventsTable.collegeId, profile.collegeId),
          eq(eventsTable.status, "PUBLISHED"),
          gte(eventsTable.startsAt, now),
        )!
      : sql`false`;
    const [discover, registered, attendance, feedback, certificates] =
      await Promise.all([
        countRows(eventsTable, eventScope),
        countRows(eventRegistrationsTable, registrationsScope),
        countRows(
          attendanceTable,
          inArray(attendanceTable.registrationId, registrations),
        ),
        countRows(feedbackTable, eq(feedbackTable.userId, profile.id)),
        countRows(certificatesTable, eq(certificatesTable.recipientId, profile.id)),
      ]);
    metrics = [
      metric("discover", "Discover events", discover, "Upcoming on your campus", "accent"),
      metric("registrations", "My registrations", registered, "Your event sign-ups"),
      metric("qr", "QR passes", 0, "Passes arrive in a later phase"),
      metric("attendance", "Attendance", attendance, "Your check-in history"),
      metric("feedback", "Feedback", feedback, "Submitted event feedback"),
      metric("certificates", "Certificates", certificates, "Your certificate vault"),
    ];
    events = profile.collegeId ? await eventRows(eventScope) : [];
    const [rows] = await Promise.all([
      db
        .select({
          id: auditLogsTable.id,
          title: auditLogsTable.action,
          detail: auditLogsTable.entityType,
          occurredAt: auditLogsTable.createdAt,
        })
        .from(auditLogsTable)
        .where(eq(auditLogsTable.actorId, profile.id))
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(5),
    ]);
    activity = rows;
  } else {
    const assignmentScope = eq(volunteerAssignmentsTable.volunteerId, profile.id);
    const [eventTotal, tasks, upcomingShifts, attendance] = await Promise.all([
      countRows(
        volunteerAssignmentsTable,
        assignmentScope,
      ),
      countRows(tasksTable, eq(tasksTable.assigneeId, profile.id)),
      countRows(
        volunteerAssignmentsTable,
        and(
          assignmentScope,
          gte(volunteerAssignmentsTable.startsAt, now),
        )!,
      ),
      countRows(
        attendanceTable,
        eq(attendanceTable.checkedInBy, profile.id),
      ),
    ]);
    metrics = [
      metric("events", "Assigned events", eventTotal, "Events on your roster", "accent"),
      metric("tasks", "Tasks", tasks, "Assigned to you"),
      metric("schedule", "Upcoming shifts", upcomingShifts, "Duty schedule"),
      metric("attendance", "Check-ins", attendance, "Recorded by you"),
    ];
    const ids = await db
      .selectDistinct({ id: volunteerAssignmentsTable.eventId })
      .from(volunteerAssignmentsTable)
      .where(assignmentScope);
    events = ids.length
      ? await eventRows(inArray(eventsTable.id, ids.map((row) => row.id)))
      : [];
    const [rows] = await Promise.all([
      db
        .select({
          id: auditLogsTable.id,
          title: auditLogsTable.action,
          detail: auditLogsTable.entityType,
          occurredAt: auditLogsTable.createdAt,
        })
        .from(auditLogsTable)
        .where(eq(auditLogsTable.actorId, profile.id))
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(5),
    ]);
    activity = rows;
  }

  return {
    role: profile.roleKey as AppRole,
    collegeName: null,
    greeting: profile.name,
    metrics,
    events,
    activity: activity.map((item) => ({
      id: item.id,
      title: item.title.replaceAll("_", " ").toLowerCase(),
      detail: item.detail.replaceAll("_", " ").toLowerCase(),
      occurredAt: item.occurredAt,
    })),
  };
}

router.get(
  "/dashboard/summary",
  requireAuthenticatedProfile,
  async (_req, res): Promise<void> => {
    const profile = res.locals.currentProfile as UserProfile;
    const summary = await buildDashboard(profile);
    let collegeName: string | null = null;
    if (profile.collegeId) {
      const [college] = await db
        .select({ name: collegesTable.name })
        .from(collegesTable)
        .where(eq(collegesTable.id, profile.collegeId))
        .limit(1);
      collegeName = college?.name ?? null;
    }
    res.json(
      GetDashboardSummaryResponse.parse({
        ...summary,
        greeting: profile.name,
        collegeName,
      }),
    );
  },
);

export default router;