"use server";

import { Prisma } from "@prisma/client";
import { audit, runAction } from "@/lib/action";
import { teamChanged } from "@/lib/activity";
import { ActionError } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireTeamAccess } from "@/lib/team-access";
import { createTagSchema, teamScoped, updateTagSchema } from "@/lib/validations";

/*
 * A team's tags, for tasks. Tasks store tag names, so renaming a tag rewrites
 * it everywhere and deleting one removes it, in the same transaction. (Ideas
 * no longer carry tags; old ones they have are kept in step too.)
 * Owners and co-owners can always manage tags; custom roles need "Manage tags".
 */

const MAX_TAGS = 30;

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Renames (or, with `to` = null, removes) a tag on every idea and task in the team that has it. */
async function retag(tx: Tx, teamId: string, from: string, to: string | null) {
  const swap = (tags: string[]) => [...new Set(tags.flatMap((t) => (t === from ? (to ? [to] : []) : [t])))];
  const ideas = await tx.idea.findMany({ where: { teamId, tags: { has: from } }, select: { id: true, tags: true } });
  for (const idea of ideas) await tx.idea.update({ where: { id: idea.id }, data: { tags: swap(idea.tags) } });
  const tasks = await tx.task.findMany({ where: { teamId, tags: { has: from } }, select: { id: true, tags: true } });
  for (const task of tasks) await tx.task.update({ where: { id: task.id }, data: { tags: swap(task.tags) } });
}

const taken = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export async function createTag(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, name, color } = createTagSchema.parse(input);
    await requireTeamAccess(teamId, ctx.user.id, "tags.manage");
    if ((await db.teamTag.count({ where: { teamId } })) >= MAX_TAGS) throw new ActionError(`A team can have at most ${MAX_TAGS} tags.`);
    try {
      const tag = await db.teamTag.create({ data: { teamId, name, color }, select: { id: true } });
      await audit(ctx, { teamId, action: "tag.created", entityType: "TeamTag", entityId: tag.id });
      await teamChanged(teamId);
      return { id: tag.id };
    } catch (e) {
      if (taken(e)) throw new ActionError(`#${name} already exists.`);
      throw e;
    }
  });
}

export async function updateTag(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, name, color } = updateTagSchema.parse(input);
    await requireTeamAccess(teamId, ctx.user.id, "tags.manage");
    const tag = await db.teamTag.findFirst({ where: { id: itemId, teamId }, select: { name: true } });
    if (!tag) throw new ActionError("Tag not found.");
    try {
      await db.$transaction(async (tx) => {
        await tx.teamTag.update({ where: { id: itemId }, data: { name, color } });
        if (tag.name !== name) await retag(tx, teamId, tag.name, name);
      });
    } catch (e) {
      if (taken(e)) throw new ActionError(`#${name} already exists.`);
      throw e;
    }
    await audit(ctx, { teamId, action: "tag.updated", entityType: "TeamTag", entityId: itemId });
    await teamChanged(teamId);
    return null;
  });
}

export async function deleteTag(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId } = teamScoped.parse(input);
    await requireTeamAccess(teamId, ctx.user.id, "tags.manage");
    const tag = await db.teamTag.findFirst({ where: { id: itemId, teamId }, select: { name: true } });
    if (!tag) throw new ActionError("Tag not found.");
    await db.$transaction(async (tx) => {
      await retag(tx, teamId, tag.name, null);
      await tx.teamTag.delete({ where: { id: itemId } });
    });
    await audit(ctx, { teamId, action: "tag.deleted", entityType: "TeamTag", entityId: itemId });
    await teamChanged(teamId);
    return null;
  });
}
