-- CreateTable
CREATE TABLE "scheduled_shifts" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "shift_type" TEXT NOT NULL DEFAULT 'patrol',
    "department_id" TEXT,
    "erlc_server" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "scheduled_start" TIMESTAMP(3) NOT NULL,
    "scheduled_end" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER,
    "required_host_count" INTEGER NOT NULL DEFAULT 1,
    "required_staff_count" INTEGER NOT NULL DEFAULT 0,
    "min_rank_order" INTEGER,
    "required_permission" TEXT,
    "required_department_id" TEXT,
    "claim_policy" TEXT NOT NULL DEFAULT 'FIRST_ELIGIBLE',
    "attendance_policy" TEXT NOT NULL DEFAULT 'MANUAL',
    "prc_sync_policy" TEXT NOT NULL DEFAULT 'SUGGEST_ONLY',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "host_membership_id" TEXT,
    "co_host_membership_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "claimed_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "completion_notes" TEXT,
    "recurrence_id" TEXT,
    "discord_channel_id" TEXT,
    "discord_message_id" TEXT,
    "discord_event_id" TEXT,
    "discord_state" TEXT NOT NULL DEFAULT 'NONE',
    "prc_sync_state" TEXT NOT NULL DEFAULT 'IDLE',
    "last_reminded_offset" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" TEXT NOT NULL,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_claims" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scheduled_shift_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'host',
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "decided_by_user_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_shift_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scheduled_shift_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "scheduled_shift_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prc_presence_matches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scheduled_shift_id" TEXT NOT NULL,
    "roblox_user_id" TEXT NOT NULL,
    "roblox_username" TEXT NOT NULL,
    "membership_id" TEXT,
    "user_id" TEXT,
    "team" TEXT,
    "callsign" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "presence_minutes" INTEGER NOT NULL DEFAULT 0,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prc_presence_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_recurrences" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rule" JSONB NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "duration_minutes" INTEGER NOT NULL DEFAULT 120,
    "department_id" TEXT,
    "erlc_server" TEXT,
    "shift_type" TEXT NOT NULL DEFAULT 'patrol',
    "horizon_until" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_recurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_scheduling_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "discord_channel_id" TEXT,
    "discord_event_location" TEXT,
    "announcement_template" TEXT,
    "mention_role_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hosts_may_publish" BOOLEAN NOT NULL DEFAULT true,
    "approval_before_publish" BOOLEAN NOT NULL DEFAULT false,
    "update_on_change" BOOLEAN NOT NULL DEFAULT true,
    "cancel_deletes_event" BOOLEAN NOT NULL DEFAULT true,
    "reminder_offsets" INTEGER[] DEFAULT ARRAY[1440, 60, 15]::INTEGER[],
    "allow_publish_without_host" BOOLEAN NOT NULL DEFAULT false,
    "start_window_minutes" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_scheduling_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_shifts_public_id_key" ON "scheduled_shifts"("public_id");

-- CreateIndex
CREATE INDEX "scheduled_shifts_organization_id_status_idx" ON "scheduled_shifts"("organization_id", "status");

-- CreateIndex
CREATE INDEX "scheduled_shifts_organization_id_scheduled_start_idx" ON "scheduled_shifts"("organization_id", "scheduled_start");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_shifts_recurrence_id_scheduled_start_key" ON "scheduled_shifts"("recurrence_id", "scheduled_start");

-- CreateIndex
CREATE UNIQUE INDEX "shift_claims_public_id_key" ON "shift_claims"("public_id");

-- CreateIndex
CREATE INDEX "shift_claims_scheduled_shift_id_idx" ON "shift_claims"("scheduled_shift_id");

-- CreateIndex
CREATE INDEX "shift_claims_organization_id_membership_id_idx" ON "shift_claims"("organization_id", "membership_id");

-- CreateIndex
CREATE INDEX "scheduled_shift_events_scheduled_shift_id_occurred_at_idx" ON "scheduled_shift_events"("scheduled_shift_id", "occurred_at");

-- CreateIndex
CREATE INDEX "prc_presence_matches_organization_id_scheduled_shift_id_idx" ON "prc_presence_matches"("organization_id", "scheduled_shift_id");

-- CreateIndex
CREATE UNIQUE INDEX "prc_presence_matches_scheduled_shift_id_roblox_user_id_key" ON "prc_presence_matches"("scheduled_shift_id", "roblox_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_recurrences_public_id_key" ON "shift_recurrences"("public_id");

-- CreateIndex
CREATE INDEX "shift_recurrences_organization_id_active_idx" ON "shift_recurrences"("organization_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "shift_scheduling_settings_organization_id_key" ON "shift_scheduling_settings"("organization_id");

-- AddForeignKey
ALTER TABLE "scheduled_shifts" ADD CONSTRAINT "scheduled_shifts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_claims" ADD CONSTRAINT "shift_claims_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_shift_events" ADD CONSTRAINT "scheduled_shift_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prc_presence_matches" ADD CONSTRAINT "prc_presence_matches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_recurrences" ADD CONSTRAINT "shift_recurrences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_scheduling_settings" ADD CONSTRAINT "shift_scheduling_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

