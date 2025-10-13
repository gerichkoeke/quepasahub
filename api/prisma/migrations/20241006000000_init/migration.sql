-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('in', 'out');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('waha', 'typebot');

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "session_mappings" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "typebot_flow_id" TEXT NOT NULL,
    "typebot_host" TEXT NOT NULL,
    "typebot_api_key" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "provider" "Provider" NOT NULL,
    "session_id" TEXT,
    "peer" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_mappings_session_id_active_idx" ON "session_mappings"("session_id", "active");

-- CreateIndex
CREATE INDEX "event_logs_session_id_created_at_idx" ON "event_logs"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "event_logs_created_at_idx" ON "event_logs"("created_at");
