-- CreateTable
CREATE TABLE "quepasa_mappings" (
    "id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "name" TEXT,
    "chatwoot_base_url" TEXT NOT NULL,
    "chatwoot_api_token" TEXT NOT NULL,
    "chatwoot_account_id" TEXT NOT NULL,
    "chatwoot_inbox_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quepasa_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quepasa_mappings_phone_number_key" ON "quepasa_mappings"("phone_number");

-- CreateIndex
CREATE INDEX "quepasa_mappings_phone_number_active_idx" ON "quepasa_mappings"("phone_number", "active");

-- Add Chatwoot fields to session_mappings (optional, for future Waha-Chatwoot integration)
ALTER TABLE "session_mappings" ADD COLUMN IF NOT EXISTS "chatwoot_base_url" TEXT;
ALTER TABLE "session_mappings" ADD COLUMN IF NOT EXISTS "chatwoot_api_token" TEXT;
ALTER TABLE "session_mappings" ADD COLUMN IF NOT EXISTS "chatwoot_account_id" TEXT;
ALTER TABLE "session_mappings" ADD COLUMN IF NOT EXISTS "chatwoot_inbox_id" TEXT;
