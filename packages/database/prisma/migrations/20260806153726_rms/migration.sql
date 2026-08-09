-- CreateTable
CREATE TABLE "rms_sequences" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rms_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rms_cases" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "narrative" TEXT NOT NULL DEFAULT '',
    "lead_user_id" TEXT,
    "created_by_user_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rms_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rms_evidence" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'item',
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'COLLECTED',
    "storage_location" TEXT,
    "location" TEXT,
    "collected_by_user_id" TEXT,
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "case_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rms_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rms_custody_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "evidence_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "from_user_id" TEXT,
    "to_user_id" TEXT,
    "reason" TEXT,
    "condition" TEXT,
    "signature" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rms_custody_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rms_persons" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dob" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "flags" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rms_persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rms_vehicles" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "color" TEXT,
    "owner_person_id" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "flags" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rms_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rms_properties" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'item',
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'IN_STORAGE',
    "storage_location" TEXT,
    "owner_person_id" TEXT,
    "disposition" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rms_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rms_records" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "data" JSONB NOT NULL DEFAULT '{}',
    "workflow_submission_id" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rms_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rms_links" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "from_type" TEXT NOT NULL,
    "from_id" TEXT NOT NULL,
    "to_type" TEXT NOT NULL,
    "to_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rms_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rms_timeline_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "record_type" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rms_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rms_sequences_organization_id_key_key" ON "rms_sequences"("organization_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "rms_cases_public_id_key" ON "rms_cases"("public_id");

-- CreateIndex
CREATE INDEX "rms_cases_organization_id_status_idx" ON "rms_cases"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rms_cases_organization_id_number_key" ON "rms_cases"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "rms_evidence_public_id_key" ON "rms_evidence"("public_id");

-- CreateIndex
CREATE INDEX "rms_evidence_organization_id_status_idx" ON "rms_evidence"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rms_evidence_organization_id_number_key" ON "rms_evidence"("organization_id", "number");

-- CreateIndex
CREATE INDEX "rms_custody_events_organization_id_evidence_id_idx" ON "rms_custody_events"("organization_id", "evidence_id");

-- CreateIndex
CREATE UNIQUE INDEX "rms_custody_events_evidence_id_sequence_key" ON "rms_custody_events"("evidence_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "rms_persons_public_id_key" ON "rms_persons"("public_id");

-- CreateIndex
CREATE INDEX "rms_persons_organization_id_name_idx" ON "rms_persons"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "rms_persons_organization_id_number_key" ON "rms_persons"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "rms_vehicles_public_id_key" ON "rms_vehicles"("public_id");

-- CreateIndex
CREATE INDEX "rms_vehicles_organization_id_plate_idx" ON "rms_vehicles"("organization_id", "plate");

-- CreateIndex
CREATE UNIQUE INDEX "rms_vehicles_organization_id_number_key" ON "rms_vehicles"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "rms_properties_public_id_key" ON "rms_properties"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "rms_properties_organization_id_number_key" ON "rms_properties"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "rms_records_public_id_key" ON "rms_records"("public_id");

-- CreateIndex
CREATE INDEX "rms_records_organization_id_type_status_idx" ON "rms_records"("organization_id", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rms_records_organization_id_number_key" ON "rms_records"("organization_id", "number");

-- CreateIndex
CREATE INDEX "rms_links_organization_id_from_type_from_id_idx" ON "rms_links"("organization_id", "from_type", "from_id");

-- CreateIndex
CREATE INDEX "rms_links_organization_id_to_type_to_id_idx" ON "rms_links"("organization_id", "to_type", "to_id");

-- CreateIndex
CREATE UNIQUE INDEX "rms_links_organization_id_from_type_from_id_to_type_to_id_r_key" ON "rms_links"("organization_id", "from_type", "from_id", "to_type", "to_id", "relation");

-- CreateIndex
CREATE INDEX "rms_timeline_events_organization_id_record_type_record_id_idx" ON "rms_timeline_events"("organization_id", "record_type", "record_id");

-- AddForeignKey
ALTER TABLE "rms_sequences" ADD CONSTRAINT "rms_sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rms_cases" ADD CONSTRAINT "rms_cases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rms_evidence" ADD CONSTRAINT "rms_evidence_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rms_custody_events" ADD CONSTRAINT "rms_custody_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rms_custody_events" ADD CONSTRAINT "rms_custody_events_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "rms_evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rms_persons" ADD CONSTRAINT "rms_persons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rms_vehicles" ADD CONSTRAINT "rms_vehicles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rms_properties" ADD CONSTRAINT "rms_properties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rms_records" ADD CONSTRAINT "rms_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rms_links" ADD CONSTRAINT "rms_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rms_timeline_events" ADD CONSTRAINT "rms_timeline_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

