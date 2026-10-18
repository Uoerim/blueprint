import "server-only";
import { audit, type Ctx } from "@/lib/action";
import { teamChanged } from "@/lib/activity";
import { encryptOptional, encryptText } from "@/lib/crypto";
import { db } from "@/lib/db";
import { requireTeamAccess } from "@/lib/team-access";
import { createIdeaSchema } from "@/lib/validations";

/* Idea operations shared by the app's server actions and Connect Claude (see lib/ops/tasks.ts). */

export async function opCreateIdea(ctx: Ctx, input: unknown) {
    const data = createIdeaSchema.parse(input);
    await requireTeamAccess(data.teamId, ctx.user.id, "ideas.create");
    const idea = await db.idea.create({
      data: {
        ...(data.id && { id: data.id }),
        teamId: data.teamId,
        title: encryptText(data.title, data.teamId),
        description: encryptOptional(data.description, data.teamId),
        // "Made by Claude" is permanent (a database trigger refuses changes).
        createdVia: ctx.via ?? null,
        createdById: ctx.user.id,
      },
      select: { id: true },
    });
    await audit(ctx, { teamId: data.teamId, action: "idea.created", entityType: "Idea", entityId: idea.id, ideaId: idea.id });
    await teamChanged(data.teamId);
    return { id: idea.id };
}
