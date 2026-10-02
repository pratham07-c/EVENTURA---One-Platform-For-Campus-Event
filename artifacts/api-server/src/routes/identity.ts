import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetCurrentUserResponse,
  UpdateMyProfileBody,
  UpdateMyProfileResponse,
} from "@workspace/api-zod";
import { db, userProfilesTable, type UserProfile } from "@workspace/db";
import {
  loadProfileView,
  requireAuthenticatedProfile,
  toUserProfileResponse,
} from "../middlewares/authorization";

const router: IRouter = Router();

router.get(
  "/auth/me",
  requireAuthenticatedProfile,
  async (_req, res): Promise<void> => {
    const current = res.locals.currentProfile as UserProfile;
    const view = await loadProfileView(current.id);
    if (!view) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    res.json(GetCurrentUserResponse.parse(toUserProfileResponse(view)));
  },
);

router.patch(
  "/profile",
  requireAuthenticatedProfile,
  async (req, res): Promise<void> => {
    const parsed = UpdateMyProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const current = res.locals.currentProfile as UserProfile;
    const updates: Partial<typeof userProfilesTable.$inferInsert> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
    if (parsed.data.department !== undefined) {
      updates.departmentName = parsed.data.department;
    }
    if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Provide at least one profile field." });
      return;
    }

    await db
      .update(userProfilesTable)
      .set(updates)
      .where(eq(userProfilesTable.id, current.id));

    const view = await loadProfileView(current.id);
    if (!view) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    res.json(UpdateMyProfileResponse.parse(toUserProfileResponse(view)));
  },
);

export default router;