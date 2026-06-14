-- =====================================================
-- 10-Feature Sweep — Engagement / Workflow / Analytics
-- =====================================================

-- 1. Issue subscriptions (citizen follow)
CREATE TABLE "IssueSubscription" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IssueSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IssueSubscription_issueId_userId_key" ON "IssueSubscription"("issueId", "userId");
CREATE INDEX "IssueSubscription_userId_idx" ON "IssueSubscription"("userId");

-- 2. Issue sharing (public share token)
CREATE TABLE "IssueShareLink" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "IssueShareLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IssueShareLink_token_key" ON "IssueShareLink"("token");
CREATE INDEX "IssueShareLink_issueId_idx" ON "IssueShareLink"("issueId");
CREATE INDEX "IssueShareLink_createdById_idx" ON "IssueShareLink"("createdById");

-- 3. Saved searches (issue filter combos)
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch"("userId");

-- 4. Notification preferences (per-channel opt-in)
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationPreference_userId_channel_type_key" ON "NotificationPreference"("userId", "channel", "type");
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- 5. Internal notes on issues (staff-only)
CREATE TABLE "InternalNote" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InternalNote_issueId_idx" ON "InternalNote"("issueId");

-- 6. SLA tracking (response/resolution timer)
CREATE TABLE "SlaTracking" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "breached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SlaTracking_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SlaTracking_issueId_key" ON "SlaTracking"("issueId");
CREATE INDEX "SlaTracking_breached_dueAt_idx" ON "SlaTracking"("breached", "dueAt");

-- 7. Assignment history (audit trail)
CREATE TABLE "IssueAssignment" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "assignedById" TEXT NOT NULL,
    "unassignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "reason" TEXT,
    CONSTRAINT "IssueAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IssueAssignment_issueId_assignedAt_idx" ON "IssueAssignment"("issueId", "assignedAt");

-- Foreign keys (cascade on issue/user delete)
ALTER TABLE "IssueSubscription" ADD CONSTRAINT "IssueSubscription_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IssueSubscription" ADD CONSTRAINT "IssueSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IssueShareLink" ADD CONSTRAINT "IssueShareLink_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IssueShareLink" ADD CONSTRAINT "IssueShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SlaTracking" ADD CONSTRAINT "SlaTracking_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IssueAssignment" ADD CONSTRAINT "IssueAssignment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IssueAssignment" ADD CONSTRAINT "IssueAssignment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IssueAssignment" ADD CONSTRAINT "IssueAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IssueAssignment" ADD CONSTRAINT "IssueAssignment_unassignedById_fkey" FOREIGN KEY ("unassignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
