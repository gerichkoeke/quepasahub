-- AlterTable
ALTER TABLE "quepasa_mappings"
  ALTER COLUMN "phone_number" DROP NOT NULL,
  ALTER COLUMN "name" SET NOT NULL;
