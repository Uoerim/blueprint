-- Site-wide staff roles, suspensions and account tombstones.
CREATE TYPE "SiteRole" AS ENUM ('USER', 'SUPPORT', 'MODERATOR', 'ADMIN');

ALTER TABLE "User"
  ADD COLUMN "siteRole" "SiteRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN "bannedAt" TIMESTAMP(3),
  ADD COLUMN "banReason" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "User_siteRole_idx" ON "User"("siteRole");
