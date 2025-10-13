-- AlterTable
ALTER TABLE "quepasa_mappings" ADD COLUMN "quepasa_token" TEXT;

-- Generate unique tokens for existing records
UPDATE "quepasa_mappings"
SET "quepasa_token" = 'quepasa-' || SUBSTRING(gen_random_uuid()::text, 1, 8)
WHERE "quepasa_token" IS NULL;

-- Make quepasa_token NOT NULL and UNIQUE after populating
ALTER TABLE "quepasa_mappings" ALTER COLUMN "quepasa_token" SET NOT NULL;
CREATE UNIQUE INDEX "quepasa_mappings_quepasa_token_key" ON "quepasa_mappings"("quepasa_token");
