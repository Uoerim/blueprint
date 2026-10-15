import "server-only";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import type { User } from "@prisma/client";
import { ActionError, getViewer, requireOnboarded } from "./auth";
import { db } from "./db";
import { rateLimitRequest, type Tier } from "./rate-limit";
import { getClientIp, isSameOrigin } from "./request";

import type { ActionResult } from "./action-types";
export type { ActionResult };

type Ctx = { user: User; ip: string };

/**
 * Every mutation goes through here: origin check (CSRF), rate limit by IP and
 * user, auth + onboarding, then the handler. Errors are mapped to safe,
 * generic messages — stack traces and Prisma codes never reach the client.
 */
export async function runAction<T>(
  options: { tier: Tier; onboarded?: boolean },
  handler: (ctx: Ctx) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const h = await headers();
    if (!isSameOrigin(h)) return { ok: false, error: "Request blocked." };
    const ip = getClientIp(h);

    const viewer = await getViewer();
    if (!viewer) return { ok: false, error: "Sign in required." };

    const rl = await rateLimitRequest(options.tier, ip, viewer.id);
    if (!rl.success) {
      const secs = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
      return { ok: false, error: `Slow down — try again in ${secs}s.` };
    }

    const user = options.onboarded === false ? viewer : await requireOnboarded();
    return { ok: true, data: await handler({ user, ip }) };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ActionError) return { ok: false, error: e.message };
    if (e instanceof ZodError) {
      return { ok: false, error: e.issues[0]?.message ?? "Invalid input." };
    }
    console.error("[action]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function audit(
  ctx: Ctx,
  entry: { teamId?: string | null; action: string; entityType: string; entityId: string },
) {
  try {
    await db.auditLog.create({
      data: { ...entry, userId: ctx.user.id, ipAddress: ctx.ip },
    });
  } catch (e) {
    console.error("[audit]", e);
  }
}
