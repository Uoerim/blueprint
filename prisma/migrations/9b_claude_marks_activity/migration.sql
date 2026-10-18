-- Claude marks and team activity.
--   1. Ideas, tasks and subtasks remember when Claude made them ("createdVia"),
--      tasks and subtasks when Claude finished them ("completedVia"), and tasks
--      when Claude last worked on them ("claudeAt").
--   2. Activity entries carry the task and idea they belong to, plus non-content
--      details, so projects, tasks and teams can show their own history.
--   3. Backfill from the audit trail for what Claude already did.
--   4. "Made by Claude" can never be changed or removed, and once Claude has
--      worked on a task that can never be cleared: triggers refuse it, even
--      from raw SQL or scripts.

-- AlterTable
ALTER TABLE "Idea" ADD COLUMN     "createdVia" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "claudeAt" TIMESTAMP(3),
ADD COLUMN     "completedVia" TEXT,
ADD COLUMN     "createdVia" TEXT;

-- AlterTable
ALTER TABLE "Subtask" ADD COLUMN     "completedVia" TEXT,
ADD COLUMN     "createdVia" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "detail" TEXT,
ADD COLUMN     "ideaId" TEXT,
ADD COLUMN     "taskId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_ideaId_createdAt_idx" ON "AuditLog"("ideaId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_taskId_createdAt_idx" ON "AuditLog"("taskId", "createdAt");


-- 3. Backfill (before the triggers exist).
UPDATE "Idea" SET "createdVia" = 'claude'
  WHERE "id" IN (SELECT "entityId" FROM "AuditLog" WHERE "via" = 'claude' AND "action" = 'idea.created');
UPDATE "Task" SET "createdVia" = 'claude'
  WHERE "id" IN (SELECT "entityId" FROM "AuditLog" WHERE "via" = 'claude' AND "action" = 'task.created');
UPDATE "Task" AS t SET "claudeAt" = a."at"
  FROM (SELECT "entityId", max("createdAt") AS "at" FROM "AuditLog" WHERE "via" = 'claude' AND "entityType" = 'Task' GROUP BY "entityId") AS a
  WHERE a."entityId" = t."id";
UPDATE "Task" SET "completedVia" = 'claude'
  WHERE "status" = 'DONE' AND "id" IN (SELECT "entityId" FROM "AuditLog" WHERE "via" = 'claude' AND "action" = 'task.done');

-- 4. Permanent marks.
CREATE FUNCTION "bp_keep_created_via"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."createdVia" IS DISTINCT FROM OLD."createdVia" THEN
    RAISE EXCEPTION '%."createdVia" is permanent and cannot be changed', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE FUNCTION "bp_keep_claude_at"() RETURNS TRIGGER AS $$
BEGIN
  IF OLD."claudeAt" IS NOT NULL AND NEW."claudeAt" IS NULL THEN
    RAISE EXCEPTION 'Task."claudeAt" can never be cleared';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Idea_keep_created_via" BEFORE UPDATE ON "Idea" FOR EACH ROW EXECUTE FUNCTION "bp_keep_created_via"();
CREATE TRIGGER "Task_keep_created_via" BEFORE UPDATE ON "Task" FOR EACH ROW EXECUTE FUNCTION "bp_keep_created_via"();
CREATE TRIGGER "Subtask_keep_created_via" BEFORE UPDATE ON "Subtask" FOR EACH ROW EXECUTE FUNCTION "bp_keep_created_via"();
CREATE TRIGGER "Task_keep_claude_at" BEFORE UPDATE ON "Task" FOR EACH ROW EXECUTE FUNCTION "bp_keep_claude_at"();
