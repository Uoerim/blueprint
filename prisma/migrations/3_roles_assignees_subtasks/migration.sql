-- Team roles: ADMIN becomes CO_OWNER (renamed in place, so existing rows keep their role),
-- plus custom roles. Tasks: multiple assignees with per-person focus, subtasks,
-- a description, visibility and who completed them. Existing data is carried over.

-- 1. Roles ---------------------------------------------------------------------
ALTER TYPE "Role" RENAME VALUE 'ADMIN' TO 'CO_OWNER';

CREATE TABLE "TeamRole" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8B5CF6',
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeamRole_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TeamRole_teamId_idx" ON "TeamRole"("teamId");
CREATE UNIQUE INDEX "TeamRole_teamId_name_key" ON "TeamRole"("teamId", "name");
ALTER TABLE "TeamRole" ADD CONSTRAINT "TeamRole_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamMember" ADD COLUMN "customRoleId" TEXT;
CREATE INDEX "TeamMember_customRoleId_idx" ON "TeamMember"("customRoleId");
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "TeamRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Task fields ---------------------------------------------------------------
CREATE TYPE "TaskVisibility" AS ENUM ('TEAM', 'ASSIGNEES');

ALTER TABLE "Task"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "visibility" "TaskVisibility" NOT NULL DEFAULT 'TEAM',
  ADD COLUMN "completedById" TEXT;
ALTER TABLE "Task" ADD CONSTRAINT "Task_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Multiple assignees, focus moves onto the assignment ------------------------
CREATE TABLE "TaskAssignee" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "focusedAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId", "userId")
);
CREATE INDEX "TaskAssignee_userId_teamId_idx" ON "TaskAssignee"("userId", "teamId");
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "TaskAssignee" ("taskId", "userId", "teamId", "focusedAt", "assignedAt")
SELECT "id", "assigneeId", "teamId",
       CASE WHEN "isFocused" AND "status" = 'IN_PROGRESS' THEN "updatedAt" END,
       "updatedAt"
FROM "Task"
WHERE "assigneeId" IS NOT NULL;

-- Finished tasks were finished by their assignee.
UPDATE "Task" SET "completedById" = "assigneeId" WHERE "status" = 'DONE' AND "assigneeId" IS NOT NULL;

ALTER TABLE "Task" DROP CONSTRAINT "Task_assigneeId_fkey";
ALTER TABLE "Task" DROP COLUMN "assigneeId", DROP COLUMN "isFocused";

-- 4. Subtasks ------------------------------------------------------------------
CREATE TABLE "Subtask" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subtask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Subtask_taskId_idx" ON "Subtask"("taskId");
ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SubtaskAssignee" (
    "subtaskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "SubtaskAssignee_pkey" PRIMARY KEY ("subtaskId", "userId")
);
CREATE INDEX "SubtaskAssignee_userId_idx" ON "SubtaskAssignee"("userId");
ALTER TABLE "SubtaskAssignee" ADD CONSTRAINT "SubtaskAssignee_subtaskId_fkey" FOREIGN KEY ("subtaskId") REFERENCES "Subtask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubtaskAssignee" ADD CONSTRAINT "SubtaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
