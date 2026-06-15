-- Phase D1 — Referendum tracker
-- Adds Referendum + ReferendumVote tables, two enums, and the back-relation
-- fields on User. Idempotent: re-running this migration against a fresh DB
-- after the init / ten-feature-sweep / pgvector / postgis migrations
-- produces the same schema.

-- Enums
CREATE TYPE "ReferendumStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'PASSED', 'REJECTED', 'CANCELLED');
CREATE TYPE "ReferendumChoice" AS ENUM ('YES', 'NO', 'ABSTAIN');

-- Referendum table. PK / FK columns are TEXT (matching User.id and every
-- other table in this schema) because Prisma's `String @id @default(uuid())`
-- generates a UUID-shaped *string* on the application side and stores it in
-- a text column; the DB-side `gen_random_uuid()` default is dropped in
-- favour of the application-generated id.
CREATE TABLE "Referendum" (
    "id"              TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "description"     TEXT NOT NULL,
    "body"            TEXT NOT NULL,
    "status"          "ReferendumStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
    "opensAt"         TIMESTAMP(3) NOT NULL,
    "closesAt"        TIMESTAMP(3) NOT NULL,
    "passThreshold"   DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "minParticipation" INTEGER NOT NULL DEFAULT 0,
    "eligibleRoles"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt"       TIMESTAMP(3),
    "yesCount"        INTEGER NOT NULL DEFAULT 0,
    "noCount"         INTEGER NOT NULL DEFAULT 0,
    "abstainCount"    INTEGER NOT NULL DEFAULT 0,
    "totalVotes"      INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Referendum_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Referendum_status_idx" ON "Referendum"("status");
CREATE INDEX "Referendum_closesAt_idx" ON "Referendum"("closesAt");

-- ReferendumVote table. Same TEXT-PK convention as the rest of the schema.
CREATE TABLE "ReferendumVote" (
    "id"            TEXT NOT NULL,
    "referendumId"  TEXT NOT NULL REFERENCES "Referendum"("id") ON DELETE CASCADE,
    "userId"        TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "choice"        "ReferendumChoice" NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferendumVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferendumVote_referendumId_userId_key" ON "ReferendumVote"("referendumId", "userId");
CREATE INDEX "ReferendumVote_referendumId_idx" ON "ReferendumVote"("referendumId");
CREATE INDEX "ReferendumVote_userId_idx" ON "ReferendumVote"("userId");
