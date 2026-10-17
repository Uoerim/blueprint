-- Connect Claude: OAuth apps, per-person connections (grants), one-time codes
-- and tokens (stored as SHA-256 hashes only), the per-team Claude switch (off
-- by default) and a "via" marker on audit entries made through Claude.

-- Named "9a_" so it runs after "9_" everywhere: Prisma orders migration
-- folders by the parts of their names split on "_", so "10_" and "11_" sort
-- right after "1_". New migrations continue with "9b_", "9c_" and so on.

-- Feedback's "Rejected" status, for databases created from scratch, where
-- 10_feedback_rejected runs before the status type exists (it skips itself).
ALTER TYPE "BugReportStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- CreateEnum
CREATE TYPE "OAuthTokenKind" AS ENUM ('ACCESS', 'REFRESH');

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "agentAccess" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "via" TEXT;

-- CreateTable
CREATE TABLE "OAuthClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scopes" TEXT[],
    "teamIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "AgentGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthCode" (
    "hash" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "resource" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthCode_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "hash" TEXT NOT NULL,
    "kind" "OAuthTokenKind" NOT NULL,
    "grantId" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE INDEX "OAuthClient_createdAt_idx" ON "OAuthClient"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentGrant_userId_clientId_key" ON "AgentGrant"("userId", "clientId");

-- CreateIndex
CREATE INDEX "OAuthCode_grantId_idx" ON "OAuthCode"("grantId");

-- CreateIndex
CREATE INDEX "OAuthToken_grantId_idx" ON "OAuthToken"("grantId");

-- AddForeignKey
ALTER TABLE "AgentGrant" ADD CONSTRAINT "AgentGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGrant" ADD CONSTRAINT "AgentGrant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthCode" ADD CONSTRAINT "OAuthCode_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "AgentGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "AgentGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

