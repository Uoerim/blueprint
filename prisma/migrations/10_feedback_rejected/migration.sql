-- Staff can reject feedback (a bug that isn't one, a feature that won't be
-- built) and later delete rejected items for good. Rejection reuses the
-- resolvedAt / resolvedById columns: when it was handled, and by whom.

-- AlterEnum. Prisma orders "10_" right after "1_", so on a database created
-- from scratch this runs before 7_bug_reports has made the type: then it skips,
-- and 9a_connect_claude adds the value once the type exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'BugReportStatus' AND n.nspname = current_schema()) THEN
    ALTER TYPE "BugReportStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
  END IF;
END $$;
