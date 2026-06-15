-- Adds the 3 tables that the Prisma schema declares but that the init
-- migration (20260613191352_init) never created: Forum, ForumPost,
-- PasswordResetToken. Discovered while bringing up the test suite for
-- Phase E — `cleanupDatabase()` calls `prisma.forumPost.deleteMany()`
-- etc. and Jest blew up with "table does not exist" because the DB
-- schema had drifted from the Prisma client schema.
--
-- TEXT PK / FK columns match the convention established by the init
-- migration (Prisma's `String @id @default(uuid())` generates a
-- UUID-shaped *string* on the application side and stores it in a text
-- column, so the DB never gets `gen_random_uuid()` for those ids).

-- Forum table (parent record for a discussion topic)
CREATE TABLE "Forum" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "creatorId"   TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Forum_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Forum_creatorId_idx" ON "Forum"("creatorId");

-- ForumPost table (a single post inside a forum thread)
CREATE TABLE "ForumPost" (
    "id"        TEXT NOT NULL,
    "forumId"   TEXT NOT NULL REFERENCES "Forum"("id") ON DELETE CASCADE,
    "authorId"  TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
    "content"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ForumPost_forumId_idx" ON "ForumPost"("forumId");
CREATE INDEX "ForumPost_authorId_idx" ON "ForumPost"("authorId");

-- PasswordResetToken table (one-time token emailed to a user who forgot
-- their password; the auth service rotates these on every reset).
CREATE TABLE "PasswordResetToken" (
    "id"        TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
