-- AlterEnum: Add new provider values to the Provider enum
ALTER TYPE "Provider" ADD VALUE IF NOT EXISTS 'quepasa';
ALTER TYPE "Provider" ADD VALUE IF NOT EXISTS 'chatwoot';
