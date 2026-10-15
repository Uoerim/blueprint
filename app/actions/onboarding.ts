"use server";

import { Prisma } from "@prisma/client";
import { audit, runAction } from "@/lib/action";
import { ActionError } from "@/lib/auth";
import { db } from "@/lib/db";
import { onboardingSchema } from "@/lib/validations";

export async function completeOnboarding(input: unknown) {
  return runAction({ tier: "auth", onboarded: false }, async (ctx) => {
    const { username, accentColor } = onboardingSchema.parse(input);
    if (ctx.user.onboarded && ctx.user.username) {
      throw new ActionError("You already claimed @" + ctx.user.username + ".");
    }
    try {
      await db.user.update({
        where: { id: ctx.user.id },
        data: { username, accentColor, onboarded: true },
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
