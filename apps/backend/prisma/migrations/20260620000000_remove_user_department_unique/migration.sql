/*
  Warnings:

  - You are about to drop the column `location_geom` on the `Issue` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Forum" DROP CONSTRAINT "Forum_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "ForumPost" DROP CONSTRAINT "ForumPost_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ForumPost" DROP CONSTRAINT "ForumPost_forumId_fkey";

-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "Referendum" DROP CONSTRAINT "Referendum_createdById_fkey";

-- DropForeignKey
ALTER TABLE "ReferendumVote" DROP CONSTRAINT "ReferendumVote_referendumId_fkey";

-- DropForeignKey
ALTER TABLE "ReferendumVote" DROP CONSTRAINT "ReferendumVote_userId_fkey";

-- DropIndex
DROP INDEX "DocumentChunk_embedding_idx";

-- DropIndex
DROP INDEX "Forum_creatorId_idx";

-- DropIndex
DROP INDEX "ForumPost_authorId_idx";

-- DropIndex
DROP INDEX "ForumPost_forumId_idx";

-- DropIndex
DROP INDEX "Issue_location_geom_gist";

-- DropIndex
DROP INDEX "IssueEmbedding_embedding_idx";

-- DropIndex
DROP INDEX "PasswordResetToken_userId_idx";

-- DropIndex
DROP INDEX "User_departmentId_key";

-- AlterTable
ALTER TABLE "Forum" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ForumPost" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Issue" DROP COLUMN "location_geom",
ADD COLUMN     "locationGeom" geometry(Point, 4326);

-- AlterTable
ALTER TABLE "Referendum" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forum" ADD CONSTRAINT "Forum_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "Forum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referendum" ADD CONSTRAINT "Referendum_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferendumVote" ADD CONSTRAINT "ReferendumVote_referendumId_fkey" FOREIGN KEY ("referendumId") REFERENCES "Referendum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferendumVote" ADD CONSTRAINT "ReferendumVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
