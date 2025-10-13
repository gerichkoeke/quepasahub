-- CreateTable
CREATE TABLE "chatwoot_contacts" (
    "id" TEXT NOT NULL,
    "quepasa_mapping_id" TEXT NOT NULL,
    "chatwoot_contact_id" INTEGER NOT NULL,
    "quepasa_jid" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatwoot_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatwoot_conversations" (
    "id" TEXT NOT NULL,
    "quepasa_mapping_id" TEXT NOT NULL,
    "chatwoot_conversation_id" INTEGER NOT NULL,
    "chatwoot_contact_id" INTEGER NOT NULL,
    "quepasa_conversation_id" TEXT,
    "quepasa_jid" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatwoot_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_messages" (
    "id" TEXT NOT NULL,
    "quepasa_mapping_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chatwoot_contacts_phone_e164_idx" ON "chatwoot_contacts"("phone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "chatwoot_contacts_quepasa_mapping_id_quepasa_jid_key" ON "chatwoot_contacts"("quepasa_mapping_id", "quepasa_jid");

-- CreateIndex
CREATE UNIQUE INDEX "chatwoot_contacts_quepasa_mapping_id_chatwoot_contact_id_key" ON "chatwoot_contacts"("quepasa_mapping_id", "chatwoot_contact_id");

-- CreateIndex
CREATE INDEX "chatwoot_conversations_quepasa_mapping_id_quepasa_jid_sta_idx" ON "chatwoot_conversations"("quepasa_mapping_id", "quepasa_jid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "chatwoot_conversations_quepasa_mapping_id_chatwoot_conve_key" ON "chatwoot_conversations"("quepasa_mapping_id", "chatwoot_conversation_id");

-- CreateIndex
CREATE INDEX "processed_messages_external_id_idx" ON "processed_messages"("external_id");

-- CreateIndex
CREATE INDEX "processed_messages_processed_at_idx" ON "processed_messages"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "processed_messages_quepasa_mapping_id_external_id_source_key" ON "processed_messages"("quepasa_mapping_id", "external_id", "source");
