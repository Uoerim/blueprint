-- Profile pictures, notification and team activity stamps (for the live
-- change-check), subtask descriptions, and per-team custom idea tags.

ALTER TABLE "User"
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "inboxAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Team" ADD COLUMN "activityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Subtask" ADD COLUMN "description" TEXT;

CREATE TABLE "TeamTag" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamTag_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TeamTag_teamId_idx" ON "TeamTag"("teamId");
CREATE UNIQUE INDEX "TeamTag_teamId_name_key" ON "TeamTag"("teamId", "name");
ALTER TABLE "TeamTag" ADD CONSTRAINT "TeamTag_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every existing team starts with the four built-in tags…
INSERT INTO "TeamTag" ("id", "teamId", "name", "color")
SELECT 'c' || substr(md5(t."id" || d.name || random()::text), 1, 24), t."id", d.name, d.color
FROM "Team" t
CROSS JOIN (VALUES
  ('feature', '#6366F1'),
  ('bug', '#F43F5E'),
  ('experiment', '#06B6D4'),
  ('random', '#F59E0B')
) AS d(name, color);

-- …plus any other tag its ideas already use, so nothing disappears.
INSERT INTO "TeamTag" ("id", "teamId", "name", "color")
SELECT 'c' || substr(md5(u."teamId" || u.tag || random()::text), 1, 24), u."teamId", u.tag, '#64748B'
FROM (SELECT DISTINCT i."teamId", unnest(i."tags") AS tag FROM "Idea" i) u
ON CONFLICT ("teamId", "name") DO NOTHING;
