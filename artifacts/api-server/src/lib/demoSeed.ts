import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  auditLogsTable,
  attendanceTable,
  budgetsTable,
  certificatesTable,
  clubMembersTable,
  clubsTable,
  collegesTable,
  departmentsTable,
  eventRegistrationsTable,
  eventsTable,
  expensesTable,
  feedbackTable,
  notificationsTable,
  tasksTable,
  userProfilesTable,
  volunteerAssignmentsTable,
  type AppRole,
  type Club,
  type College,
  type Department,
  type Event,
  type UserProfile,
} from "@workspace/db";

async function getDemoCollege(): Promise<College> {
  const slug = "demo-campus";
  const [existing] = await db
    .select()
    .from(collegesTable)
    .where(eq(collegesTable.slug, slug))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(collegesTable)
    .values({
      slug,
      name: "Northstar University",
      shortName: "Northstar",
      timezone: "Asia/Kolkata",
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [retried] = await db
    .select()
    .from(collegesTable)
    .where(eq(collegesTable.slug, slug))
    .limit(1);
  if (!retried) throw new Error("Could not create the EVENTURA demo campus.");
  return retried;
}

async function getDepartment(
  collegeId: string,
  name: string,
  code: string,
): Promise<Department> {
  const [existing] = await db
    .select()
    .from(departmentsTable)
    .where(
      and(
        eq(departmentsTable.collegeId, collegeId),
        eq(departmentsTable.name, name),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(departmentsTable)
    .values({ collegeId, name, code })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [retried] = await db
    .select()
    .from(departmentsTable)
    .where(
      and(
        eq(departmentsTable.collegeId, collegeId),
        eq(departmentsTable.name, name),
      ),
    )
    .limit(1);
  if (!retried) throw new Error(`Could not create demo department ${name}.`);
  return retried;
}

async function getDemoProfile(input: {
  key: string;
  name: string;
  roleKey: AppRole;
  collegeId: string;
  departmentId: string;
}): Promise<UserProfile> {
  const authUserId = `eventura_demo_${input.key}`;
  const email = `${input.key.replaceAll("_", ".")}@demo.eventura.invalid`;
  const [existing] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.authUserId, authUserId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(userProfilesTable)
    .values({
      authUserId,
      name: input.name,
      email,
      roleKey: input.roleKey,
      collegeId: input.collegeId,
      departmentId: input.departmentId,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [retried] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.authUserId, authUserId))
    .limit(1);
  if (!retried) {
    throw new Error(`Could not create demo profile ${input.name}.`);
  }
  return retried;
}

async function getDemoClub(
  collegeId: string,
  departmentId: string,
): Promise<Club> {
  const slug = "campus-makers";
  const [existing] = await db
    .select()
    .from(clubsTable)
    .where(and(eq(clubsTable.collegeId, collegeId), eq(clubsTable.slug, slug)))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(clubsTable)
    .values({
      collegeId,
      departmentId,
      name: "Campus Makers",
      slug,
      description: "A student club for design, technology, and campus projects.",
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [retried] = await db
    .select()
    .from(clubsTable)
    .where(and(eq(clubsTable.collegeId, collegeId), eq(clubsTable.slug, slug)))
    .limit(1);
  if (!retried) throw new Error("Could not create the demo club.");
  return retried;
}

function futureAtDayOffset(dayOffset: number, hour = 12): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + dayOffset,
      hour,
    ),
  );
}

async function getDemoEvent(input: {
  collegeId: string;
  departmentId: string;
  clubId: string;
  organizerId: string;
  title: string;
  status: "PUBLISHED" | "SUBMITTED";
  startsAt: Date;
  venue: string;
  category: string;
}): Promise<Event> {
  const [existing] = await db
    .select()
    .from(eventsTable)
    .where(
      and(
        eq(eventsTable.collegeId, input.collegeId),
        eq(eventsTable.title, input.title),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(eventsTable)
    .values({
      ...input,
      description: `Seeded Phase 1 fixture for the ${input.title} dashboard.`,
      endsAt: new Date(input.startsAt.getTime() + 3 * 60 * 60 * 1000),
      capacity: 180,
      registrationDeadline: new Date(input.startsAt.getTime() - 24 * 60 * 60 * 1000),
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [retried] = await db
    .select()
    .from(eventsTable)
    .where(
      and(
        eq(eventsTable.collegeId, input.collegeId),
        eq(eventsTable.title, input.title),
      ),
    )
    .limit(1);
  if (!retried) throw new Error(`Could not create demo event ${input.title}.`);
  return retried;
}

async function ensureClubMember(
  clubId: string,
  userId: string,
  membershipRole: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: clubMembersTable.id })
    .from(clubMembersTable)
    .where(
      and(
        eq(clubMembersTable.clubId, clubId),
        eq(clubMembersTable.userId, userId),
      ),
    )
    .limit(1);
  if (existing) return;
  await db
    .insert(clubMembersTable)
    .values({ clubId, userId, membershipRole })
    .onConflictDoNothing();
}

async function ensureRegistration(
  eventId: string,
  studentId: string,
): Promise<string> {
  const [existing] = await db
    .select({ id: eventRegistrationsTable.id })
    .from(eventRegistrationsTable)
    .where(
      and(
        eq(eventRegistrationsTable.eventId, eventId),
        eq(eventRegistrationsTable.studentId, studentId),
      ),
    )
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(eventRegistrationsTable)
    .values({ eventId, studentId })
    .onConflictDoNothing()
    .returning({ id: eventRegistrationsTable.id });
  if (created) return created.id;

  const [retried] = await db
    .select({ id: eventRegistrationsTable.id })
    .from(eventRegistrationsTable)
    .where(
      and(
        eq(eventRegistrationsTable.eventId, eventId),
        eq(eventRegistrationsTable.studentId, studentId),
      ),
    )
    .limit(1);
  if (!retried) throw new Error("Could not create a demo registration.");
  return retried.id;
}

async function getDemoTask(
  eventId: string,
  assigneeId: string,
  title: string,
): Promise<string> {
  const [existing] = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.eventId, eventId),
        eq(tasksTable.assigneeId, assigneeId),
        eq(tasksTable.title, title),
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(tasksTable)
    .values({
      eventId,
      assigneeId,
      title,
      description: "Example assignment included to exercise the volunteer dashboard.",
      location: "Student Union",
      dueAt: futureAtDayOffset(5, 10),
    })
    .returning({ id: tasksTable.id });
  if (!created) throw new Error(`Could not create demo task ${title}.`);
  return created.id;
}

async function ensureVolunteerAssignment(input: {
  eventId: string;
  volunteerId: string;
  taskId: string;
  dutyRole: string;
  startsAt: Date;
  endsAt: Date;
}): Promise<void> {
  const [existing] = await db
    .select({ id: volunteerAssignmentsTable.id })
    .from(volunteerAssignmentsTable)
    .where(
      and(
        eq(volunteerAssignmentsTable.eventId, input.eventId),
        eq(volunteerAssignmentsTable.volunteerId, input.volunteerId),
        eq(volunteerAssignmentsTable.taskId, input.taskId),
      ),
    )
    .limit(1);
  if (existing) return;
  await db
    .insert(volunteerAssignmentsTable)
    .values(input)
    .onConflictDoNothing();
}

export async function seedDemoData(): Promise<void> {
  const college = await getDemoCollege();
  const department = await getDepartment(
    college.id,
    "Design & Technology",
    "DTECH",
  );
  const administration = await getDepartment(
    college.id,
    "Student Affairs",
    "STUAFF",
  );

  const [admin, clubLead, organizer, student1, student2, student3, volunteer1, volunteer2] =
    await Promise.all([
      getDemoProfile({
        key: "college_admin",
        name: "Avery Campus",
        roleKey: "COLLEGE_ADMIN",
        collegeId: college.id,
        departmentId: administration.id,
      }),
      getDemoProfile({
        key: "club",
        name: "Jordan Lee",
        roleKey: "CLUB",
        collegeId: college.id,
        departmentId: department.id,
      }),
      getDemoProfile({
        key: "organizer",
        name: "Sam Rivera",
        roleKey: "ORGANIZER",
        collegeId: college.id,
        departmentId: department.id,
      }),
      getDemoProfile({
        key: "student_one",
        name: "Taylor Morgan",
        roleKey: "STUDENT",
        collegeId: college.id,
        departmentId: department.id,
      }),
      getDemoProfile({
        key: "student_two",
        name: "Casey Patel",
        roleKey: "STUDENT",
        collegeId: college.id,
        departmentId: department.id,
      }),
      getDemoProfile({
        key: "student_three",
        name: "Morgan Chen",
        roleKey: "STUDENT",
        collegeId: college.id,
        departmentId: administration.id,
      }),
      getDemoProfile({
        key: "volunteer_one",
        name: "Riley Brooks",
        roleKey: "VOLUNTEER",
        collegeId: college.id,
        departmentId: department.id,
      }),
      getDemoProfile({
        key: "volunteer_two",
        name: "Jamie Okafor",
        roleKey: "VOLUNTEER",
        collegeId: college.id,
        departmentId: administration.id,
      }),
    ]);

  const club = await getDemoClub(college.id, department.id);
  await Promise.all([
    ensureClubMember(club.id, clubLead.id, "PRESIDENT"),
    ensureClubMember(club.id, organizer.id, "ORGANIZER"),
    ensureClubMember(club.id, student1.id, "MEMBER"),
    ensureClubMember(club.id, student2.id, "MEMBER"),
    ensureClubMember(club.id, student3.id, "MEMBER"),
    ensureClubMember(club.id, volunteer1.id, "MEMBER"),
    ensureClubMember(club.id, volunteer2.id, "MEMBER"),
  ]);

  const eventOne = await getDemoEvent({
    collegeId: college.id,
    departmentId: department.id,
    clubId: club.id,
    organizerId: organizer.id,
    title: "Campus Creative Week",
    status: "PUBLISHED",
    startsAt: futureAtDayOffset(5),
    venue: "Northstar Student Union",
    category: "CULTURE",
  });
  const eventTwo = await getDemoEvent({
    collegeId: college.id,
    departmentId: department.id,
    clubId: club.id,
    organizerId: organizer.id,
    title: "Research & Innovation Forum",
    status: "SUBMITTED",
    startsAt: futureAtDayOffset(12),
    venue: "Innovation Hall",
    category: "ACADEMIC",
  });

  const registrations = await Promise.all([
    ensureRegistration(eventOne.id, student1.id),
    ensureRegistration(eventOne.id, student2.id),
    ensureRegistration(eventTwo.id, student3.id),
  ]);
  const [attendance] = await db
    .select({ id: attendanceTable.id })
    .from(attendanceTable)
    .where(eq(attendanceTable.registrationId, registrations[0]))
    .limit(1);
  if (!attendance) {
    await db
      .insert(attendanceTable)
      .values({
        registrationId: registrations[0],
        checkedInBy: volunteer1.id,
      })
      .onConflictDoNothing();
  }

  const task1 = await getDemoTask(eventOne.id, volunteer1.id, "Welcome desk");
  const task2 = await getDemoTask(eventOne.id, volunteer2.id, "Room support");
  await Promise.all([
    ensureVolunteerAssignment({
      eventId: eventOne.id,
      volunteerId: volunteer1.id,
      taskId: task1,
      dutyRole: "WELCOME_DESK",
      startsAt: eventOne.startsAt,
      endsAt: eventOne.endsAt,
    }),
    ensureVolunteerAssignment({
      eventId: eventOne.id,
      volunteerId: volunteer2.id,
      taskId: task2,
      dutyRole: "ROOM_SUPPORT",
      startsAt: eventOne.startsAt,
      endsAt: eventOne.endsAt,
    }),
  ]);

  const [budget] = await db
    .select({ id: budgetsTable.id })
    .from(budgetsTable)
    .where(eq(budgetsTable.eventId, eventOne.id))
    .limit(1);
  let budgetId = budget?.id;
  if (!budgetId) {
    const [created] = await db
      .insert(budgetsTable)
      .values({ eventId: eventOne.id, allocatedAmount: "25000.00" })
      .onConflictDoNothing()
      .returning({ id: budgetsTable.id });
    budgetId = created?.id;
  }
  if (budgetId) {
    const [expense] = await db
      .select({ id: expensesTable.id })
      .from(expensesTable)
      .where(
        and(
          eq(expensesTable.budgetId, budgetId),
          eq(expensesTable.description, "Demo printing and materials"),
        ),
      )
      .limit(1);
    if (!expense) {
      await db.insert(expensesTable).values({
        budgetId,
        submittedBy: organizer.id,
        category: "MATERIALS",
        amount: "3200.00",
        description: "Demo printing and materials",
        status: "SUBMITTED",
        spentAt: futureAtDayOffset(-1),
      });
    }
  }

  const [existingFeedback] = await db
    .select({ id: feedbackTable.id })
    .from(feedbackTable)
    .where(
      and(
        eq(feedbackTable.eventId, eventOne.id),
        eq(feedbackTable.userId, student1.id),
      ),
    )
    .limit(1);
  if (!existingFeedback) {
    await db.insert(feedbackTable).values({
      eventId: eventOne.id,
      userId: student1.id,
      rating: 5,
      comment: "A sample feedback record for the dashboard foundation.",
    });
  }

  const [existingCertificate] = await db
    .select({ id: certificatesTable.id })
    .from(certificatesTable)
    .where(
      and(
        eq(certificatesTable.eventId, eventOne.id),
        eq(certificatesTable.recipientId, student1.id),
      ),
    )
    .limit(1);
  if (!existingCertificate) {
    await db
      .insert(certificatesTable)
      .values({
        eventId: eventOne.id,
        recipientId: student1.id,
        status: "PENDING",
      })
      .onConflictDoNothing();
  }

  const [existingNotification] = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.recipientId, student1.id),
        eq(notificationsTable.title, "Welcome to EVENTURA"),
      ),
    )
    .limit(1);
  if (!existingNotification) {
    await db.insert(notificationsTable).values({
      recipientId: student1.id,
      title: "Welcome to EVENTURA",
      body: "Your campus event dashboard is ready.",
      category: "GENERAL",
    });
  }

  const [existingAuditEntry] = await db
    .select({ id: auditLogsTable.id })
    .from(auditLogsTable)
    .where(
      and(
        eq(auditLogsTable.collegeId, college.id),
        eq(auditLogsTable.actorId, admin.id),
        eq(auditLogsTable.action, "DEMO_DATA_READY"),
      ),
    )
    .limit(1);
  if (!existingAuditEntry) {
    await db.insert(auditLogsTable).values({
      collegeId: college.id,
      actorId: admin.id,
      action: "DEMO_DATA_READY",
      entityType: "DEMO_SEED",
      entityId: eventOne.id,
      metadata: { fixture: "development-only" },
    });
  }
}