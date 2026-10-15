"use server";

import { currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { audit, runAction } from "@/lib/action";
import { ActionError } from "@/lib/auth";
import { accentFor } from "@/lib/constants";
import { db } from "@/lib/db";
import { onboardingSchema } from "@/lib/validations";

export async function completeOnboarding(input: unknown) {
  return runAction({ tier: "auth", onboarded: false }, async (ctx) => {
    const { username } = onboardingSchema.parse(input);
    if (ctx.user.onboarded && ctx.user.username) {
      throw new ActionError("You already claimed @" + ctx.user.username + ".");
    }
    try {
      await db.user.update({
        where: { id: ctx.user.id },
        data: { username, accentColor: accentFor(username), imageUrl: await clerkAvatar(), onboarded: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ActionError(`@${username} was just taken. Try another.`);
      }
      throw e;
    }
    await audit(ctx, { action: "user.onboarded", entityType: "User", entityId: ctx.user.id });
    return { username };
  });
}

/** The profile picture straight from Clerk (never from the browser), or null when they haven't uploaded one. */
async function clerkAvatar() {
  const cu = await currentUser();
  return cu?.hasImage ? cu.imageUrl : null;
}

/** Re-reads the profile picture from Clerk after the person changes it. */
export async function refreshAvatar() {
  return runAction({ tier: "auth" }, async (ctx) => {
    const imageUrl = await clerkAvatar();
    if (imageUrl !== ctx.user.imageUrl) {
      await db.user.update({ where: { id: ctx.user.id }, data: { imageUrl } });
      // Teammates' screens pick up the new face on their next change-check.
      await db.team.updateMany({ where: { members: { some: { userId: ctx.user.id } } }, data: { activityAt: new Date() } });
    }
    return { imageUrl };
  });
}
