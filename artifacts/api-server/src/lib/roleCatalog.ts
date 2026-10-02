import { db, rolesTable, type AppRole } from "@workspace/db";

export const ROLE_CATALOG: ReadonlyArray<{
  roleKey: AppRole;
  displayName: string;
  scope: string;
  description: string;
}> = [
  {
    roleKey: "COLLEGE_ADMIN",
    displayName: "College Admin",
    scope: "CAMPUS",
    description: "College-wide governance and oversight.",
  },
  {
    roleKey: "CLUB",
    displayName: "Club",
    scope: "CLUB",
    description: "Access limited to the clubs the user belongs to.",
  },
  {
    roleKey: "ORGANIZER",
    displayName: "Organizer",
    scope: "EVENT",
    description: "Access limited to events organized by the user.",
  },
  {
    roleKey: "STUDENT",
    displayName: "Student",
    scope: "SELF",
    description: "Access to the user's own profile and activity.",
  },
  {
    roleKey: "VOLUNTEER",
    displayName: "Volunteer",
    scope: "ASSIGNED_EVENT",
    description: "Access limited to assigned events and tasks.",
  },
];

export async function ensureRoleCatalog(): Promise<void> {
  await db.insert(rolesTable).values([...ROLE_CATALOG]).onConflictDoNothing();
}