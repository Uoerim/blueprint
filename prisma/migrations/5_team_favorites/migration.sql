-- Members can star teams; starred teams come first on the dashboard home.
ALTER TABLE "TeamMember" ADD COLUMN "favorite" BOOLEAN NOT NULL DEFAULT false;
