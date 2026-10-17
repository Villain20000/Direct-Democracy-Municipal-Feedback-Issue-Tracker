-- P1-10 escalation workflow: keep IssueStatus stable, flag escalations
-- with dedicated columns instead of a new enum value.
ALTER TABLE "Issue" ADD COLUMN "escalatedAt" TIMESTAMP(3);
ALTER TABLE "Issue" ADD COLUMN "escalatedById" TEXT;
ALTER TABLE "Issue" ADD COLUMN "escalatedTo" TEXT;
ALTER TABLE "Issue" ADD COLUMN "escalationReason" TEXT;

CREATE INDEX "Issue_escalatedAt_idx" ON "Issue"("escalatedAt");
