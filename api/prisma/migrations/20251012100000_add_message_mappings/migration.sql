-- CreateTable
CREATE TABLE "message_mappings" (
    "id" SERIAL NOT NULL,
    "chatwootMessageId" INTEGER NOT NULL,
    "quepasaMessageId" TEXT NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_mappings_chatwootMessageId_idx" ON "message_mappings"("chatwootMessageId");

-- CreateIndex
CREATE INDEX "message_mappings_conversationId_idx" ON "message_mappings"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "message_mappings_chatwootMessageId_key" ON "message_mappings"("chatwootMessageId");
