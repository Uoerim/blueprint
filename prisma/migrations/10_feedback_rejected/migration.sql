-- Staff can reject feedback (a bug that isn't one, a feature that won't be
-- built) and later delete rejected items for good. Rejection reuses the
-- resolvedAt / resolvedById columns: when it was handled, and by whom.

-- AlterEnum
ALTER TYPE "BugReportStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
