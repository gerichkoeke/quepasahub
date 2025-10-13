-- CreateTable
CREATE TABLE "typebot_flows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typebot_id" TEXT NOT NULL,
    "typebot_host" TEXT NOT NULL,
    "api_token" TEXT,
    "prefilled_variables" JSONB,
    "result_id_template" TEXT,
    "session_id_template" TEXT,
    "storage_type" TEXT NOT NULL DEFAULT 'local',
    "enable_callbacks" BOOLEAN NOT NULL DEFAULT false,
    "on_answer_url" TEXT,
    "on_init_url" TEXT,
    "on_end_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "typebot_flows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "typebot_flows_name_key" ON "typebot_flows"("name");
