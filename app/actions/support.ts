"use server";

import { headers } from "next/headers";
import { audit, runAction } from "@/lib/action";
import { describeDevice, sealReport } from "@/lib/bug-reports";
import { db } from "@/lib/db";
import { bugReportSchema } from "@/lib/validations";

/**
 * Sends a bug report to the staff inbox (/admin/reports). Signed-in, onboarded
 * people only, at most 5 an hour each. The text is sanitised, then encrypted
 * before it's stored; only the page path and a short device summary go with it.
 */
export async function submitBugReport(input: unknown) {
  return runAction({ tier: "report" }, async (ctx) => {
    const { body, page, installed } = bugReportSchema.parse(input);
    const report = await db.bugReport.create({
      data: {
        userId: ctx.user.id,
        username: ctx.user.username,
        body: sealReport(body),
        page: page ?? null,
        device: describeDevice((await headers()).get("user-agent"), installed ?? false),
      },
      select: { id: true },
    });
    await audit(ctx, { action: "report.submitted", entityType: "BugReport", entityId: report.id });
    return null;
  });
}
