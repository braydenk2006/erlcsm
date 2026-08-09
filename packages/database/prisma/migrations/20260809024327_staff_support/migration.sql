-- AlterTable
ALTER TABLE "support_access_sessions" ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'read_only',
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'VIEW_CONFIGURATION',
ADD COLUMN     "ticket_id" TEXT;

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "requester_user_id" TEXT NOT NULL,
    "assignee_user_id" TEXT,
    "team" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "related_integration" TEXT,
    "related_feature" TEXT,
    "first_response_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "satisfaction" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "author_user_id" TEXT,
    "author_type" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_macros" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "body" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_macros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_public_id_key" ON "support_tickets"("public_id");

-- CreateIndex
CREATE INDEX "support_tickets_organization_id_status_idx" ON "support_tickets"("organization_id", "status");

-- CreateIndex
CREATE INDEX "support_tickets_assignee_user_id_status_idx" ON "support_tickets"("assignee_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_organization_id_number_key" ON "support_tickets"("organization_id", "number");

-- CreateIndex
CREATE INDEX "support_ticket_messages_ticket_id_created_at_idx" ON "support_ticket_messages"("ticket_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_macros_public_id_key" ON "support_macros"("public_id");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

