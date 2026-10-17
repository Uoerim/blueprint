-- 1. Feedback: a report from the Contact support window is a bug or a feature request.
CREATE TYPE "FeedbackKind" AS ENUM ('BUG', 'FEATURE');
ALTER TABLE "BugReport" ADD COLUMN     "kind" "FeedbackKind" NOT NULL DEFAULT 'BUG';

-- 2. Tasks can carry the team's tags, like ideas.
ALTER TABLE "Task" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 3. Deleted accounts keep their former @username for the security record.
ALTER TABLE "User" ADD COLUMN     "deletedUsername" TEXT;

-- Accounts deleted before this change: recover the name from their own audit
-- entries (the last @username they acted under), where there is one.
UPDATE "User" AS u
SET "deletedUsername" = (
  SELECT a."actorUsername" FROM "AuditLog" AS a
  WHERE a."userId" = u."id" AND a."actorUsername" IS NOT NULL
  ORDER BY a."createdAt" DESC
  LIMIT 1
)
WHERE u."deletedAt" IS NOT NULL AND u."deletedUsername" IS NULL;
