-- CreateTable
CREATE TABLE "participation_events" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER,
    "source_type" TEXT,
    "source_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "department_id" TEXT,
    "type" TEXT NOT NULL DEFAULT 'patrol',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "active_minutes" INTEGER NOT NULL DEFAULT 0,
    "current_break_started_at" TIMESTAMP(3),
    "corrected_by_user_id" TEXT,
    "correction_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_sessions" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "host_membership_id" TEXT,
    "erlc_server" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "context_type" TEXT NOT NULL,
    "context_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "registered_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3),
    "left_at" TIMESTAMP(3),
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "recorded_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "required_minutes_per_period" INTEGER NOT NULL DEFAULT 180,
    "period_days" INTEGER NOT NULL DEFAULT 7,
    "max_shift_minutes" INTEGER NOT NULL DEFAULT 720,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operations_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "participation_events_public_id_key" ON "participation_events"("public_id");

-- CreateIndex
CREATE INDEX "participation_events_organization_id_membership_id_occurred_idx" ON "participation_events"("organization_id", "membership_id", "occurred_at");

-- CreateIndex
CREATE INDEX "participation_events_organization_id_type_idx" ON "participation_events"("organization_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_public_id_key" ON "shifts"("public_id");

-- CreateIndex
CREATE INDEX "shifts_organization_id_membership_id_status_idx" ON "shifts"("organization_id", "membership_id", "status");

-- CreateIndex
CREATE INDEX "shifts_organization_id_status_idx" ON "shifts"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "operational_sessions_public_id_key" ON "operational_sessions"("public_id");

-- CreateIndex
CREATE INDEX "operational_sessions_organization_id_status_idx" ON "operational_sessions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "attendance_records_organization_id_membership_id_idx" ON "attendance_records"("organization_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_context_type_context_id_membership_id_key" ON "attendance_records"("context_type", "context_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "operations_settings_organization_id_key" ON "operations_settings"("organization_id");

-- AddForeignKey
ALTER TABLE "participation_events" ADD CONSTRAINT "participation_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_sessions" ADD CONSTRAINT "operational_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_settings" ADD CONSTRAINT "operations_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

