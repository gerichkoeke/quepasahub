-- AlterTable
ALTER TABLE "session_mappings" ADD COLUMN     "webhook_token" TEXT;

-- CreateTable
CREATE TABLE "typebot_sessions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "typebot_session_id" TEXT NOT NULL,
    "last_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "typebot_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "typebot_sessions_session_id_idx" ON "typebot_sessions"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "typebot_sessions_session_id_phone_key" ON "typebot_sessions"("session_id", "phone");
