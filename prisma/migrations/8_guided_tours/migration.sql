-- Guided tours: which ones each person has finished or skipped.
ALTER TABLE "User" ADD COLUMN     "toursDone" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Everyone who already uses Blueprint is past the welcome and first-team tours;
-- only new accounts see them. Anyone can replay them from "Take the tour".
UPDATE "User" SET "toursDone" = ARRAY['welcome', 'team']::TEXT[] WHERE "onboarded" = true;
