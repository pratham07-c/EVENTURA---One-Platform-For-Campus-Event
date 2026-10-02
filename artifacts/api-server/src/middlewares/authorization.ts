import { clerkClient, getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  collegesTable,
  departmentsTable,
  userProfilesTable,
  type AppRole,
  type UserProfile,
} from "@workspace/db";

export type UserProfileView = {
  profile: UserProfile;
  collegeName: string | null;
  departmentName: string | null;
};

export const ROLE_SCOPES: Record<AppRole, string> = {
  COLLEGE_ADMIN: "CAMPUS",
  CLUB: "CLUB",
  ORGANIZER: "EVENT",
  STUDENT: "SELF",
  VOLUNTEER: "ASSIGNED_EVENT",
};

export async function loadProfileView(
  profileId: string,
): Promise<UserProfileView | null> {
  const [row] = await db
    .select({
      profile: userProfilesTable,
      collegeName: collegesTable.name,
      departmentName: departmentsTable.name,
    })
    .from(userProfilesTable)
    .leftJoin(
      collegesTable,
      eq(userProfilesTable.collegeId, collegesTable.id),
    )
    .leftJoin(
      departmentsTable,
      eq(userProfilesTable.departmentId, departmentsTable.id),
    )
    .where(eq(userProfilesTable.id, profileId))
    .limit(1);

  return row ?? null;
}

export function toUserProfileResponse(view: UserProfileView) {
  return {
    id: view.profile.id,
    name: view.profile.name,
    email: view.profile.email,
    role: view.profile.roleKey,
    collegeName: view.collegeName,
    profile: {
      phone: view.profile.phone,
      department: view.departmentName ?? view.profile.departmentName,
      bio: view.profile.bio,
    },
    createdAt: view.profile.createdAt,
    updatedAt: view.profile.updatedAt,
  };
}

async function findOrProvisionProfile(authUserId: string): Promise<UserProfile> {
  const [existing] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.authUserId, authUserId))
    .limit(1);
  if (existing) return existing;

  const identity = await clerkClient.users.getUser(authUserId);
  const email =
    identity.primaryEmailAddress?.emailAddress ??
    identity.emailAddresses[0]?.emailAddress;

  if (!email) {
    throw new Error("The signed-in account does not have an email address.");
  }

  const name =
    identity.fullName?.trim() ||
    identity.username?.trim() ||
    email.split("@")[0] ||
    "Campus member";

  await db
    .insert(userProfilesTable)
    .values({
      authUserId,
      name,
      email: email.toLowerCase(),
      roleKey: "STUDENT",
    })
    .onConflictDoNothing();

  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.authUserId, authUserId))
    .limit(1);

  if (!profile) {
    throw new Error(
      "A profile for this account could not be created. Contact a campus administrator.",
    );
  }
  return profile;
}

export async function requireAuthenticatedProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const profile = await findOrProvisionProfile(userId);
    if (!profile.isActive) {
      res.status(403).json({ error: "This account is inactive." });
      return;
    }
    res.locals.currentProfile = profile;
    next();
  } catch (error) {
    req.log.error({ err: error }, "Unable to resolve the signed-in profile");
    next(error);
  }
}

export function requireRoles(
  ...allowedRoles: AppRole[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const profile = res.locals.currentProfile as UserProfile | undefined;
    if (!profile) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!allowedRoles.includes(profile.roleKey)) {
      res.status(403).json({ error: "You do not have access to this resource." });
      return;
    }
    next();
  };
}
