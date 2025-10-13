-- AlterTable
ALTER TABLE "session_mappings" ADD COLUMN "public_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "session_mappings_public_token_key" ON "session_mappings"("public_token");
