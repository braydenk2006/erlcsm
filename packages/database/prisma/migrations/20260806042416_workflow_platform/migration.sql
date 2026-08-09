-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "description" TEXT,
    "form" JSONB NOT NULL DEFAULT '{}',
    "workflow" JSONB NOT NULL DEFAULT '{}',
    "is_built_in" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "submit_role_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "review_role_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_submissions" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "submitter_membership_id" TEXT NOT NULL,
    "submitter_user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "current_stage_id" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_comments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'APPLICANT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_assignments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "assignee_membership_id" TEXT NOT NULL,
    "assignee_user_id" TEXT NOT NULL,
    "decision" TEXT,
    "decision_note" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_attachments" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "uploader_user_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_templates_public_id_key" ON "workflow_templates"("public_id");

-- CreateIndex
CREATE INDEX "workflow_templates_organization_id_category_idx" ON "workflow_templates"("organization_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_templates_organization_id_key_key" ON "workflow_templates"("organization_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_submissions_public_id_key" ON "workflow_submissions"("public_id");

-- CreateIndex
CREATE INDEX "workflow_submissions_organization_id_template_id_status_idx" ON "workflow_submissions"("organization_id", "template_id", "status");

-- CreateIndex
CREATE INDEX "workflow_submissions_organization_id_submitter_membership_i_idx" ON "workflow_submissions"("organization_id", "submitter_membership_id");

-- CreateIndex
CREATE INDEX "workflow_events_submission_id_created_at_idx" ON "workflow_events"("submission_id", "created_at");

-- CreateIndex
CREATE INDEX "workflow_events_organization_id_type_idx" ON "workflow_events"("organization_id", "type");

-- CreateIndex
CREATE INDEX "workflow_comments_submission_id_idx" ON "workflow_comments"("submission_id");

-- CreateIndex
CREATE INDEX "workflow_assignments_submission_id_stage_id_idx" ON "workflow_assignments"("submission_id", "stage_id");

-- CreateIndex
CREATE INDEX "workflow_assignments_assignee_membership_id_decision_idx" ON "workflow_assignments"("assignee_membership_id", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_attachments_public_id_key" ON "workflow_attachments"("public_id");

-- CreateIndex
CREATE INDEX "workflow_attachments_submission_id_idx" ON "workflow_attachments"("submission_id");

-- AddForeignKey
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_submissions" ADD CONSTRAINT "workflow_submissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_submissions" ADD CONSTRAINT "workflow_submissions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "workflow_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_comments" ADD CONSTRAINT "workflow_comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_comments" ADD CONSTRAINT "workflow_comments_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "workflow_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_assignments" ADD CONSTRAINT "workflow_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_assignments" ADD CONSTRAINT "workflow_assignments_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "workflow_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_attachments" ADD CONSTRAINT "workflow_attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_attachments" ADD CONSTRAINT "workflow_attachments_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "workflow_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

