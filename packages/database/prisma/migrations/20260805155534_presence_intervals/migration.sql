-- AlterTable
ALTER TABLE "scheduled_shifts" ADD COLUMN     "eligible_teams" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "shift_scheduling_settings" ADD COLUMN     "block_completion_on_discrepancy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "eligible_teams" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "grace_after_minutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "grace_before_minutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "max_countable_minutes" INTEGER NOT NULL DEFAULT 100000,
ADD COLUMN     "min_presence_seconds" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "reconnection_tolerance_seconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "require_host_confirmation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rounding_policy" TEXT NOT NULL DEFAULT 'EXACT',
ADD COLUMN     "window_mode" TEXT NOT NULL DEFAULT 'SCHEDULED_START';

-- CreateTable
CREATE TABLE "presence_intervals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scheduled_shift_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "roblox_user_id" TEXT NOT NULL,
    "erlc_server" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "join_at" TIMESTAMP(3),
    "leave_at" TIMESTAMP(3),
    "interval_start" TIMESTAMP(3) NOT NULL,
    "interval_end" TIMESTAMP(3),
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "team" TEXT,
    "callsign" TEXT,
    "permission_level" TEXT,
    "source" TEXT NOT NULL DEFAULT 'prc_snapshot',
    "confidence" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "reconciliation_status" TEXT NOT NULL DEFAULT 'OPEN',
    "open" BOOLEAN NOT NULL DEFAULT true,
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presence_intervals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_logged_minutes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scheduled_shift_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "automatic_minutes" INTEGER NOT NULL DEFAULT 0,
    "adjustment_minutes" INTEGER NOT NULL DEFAULT 0,
    "final_minutes" INTEGER NOT NULL DEFAULT 0,
    "raw_seconds" INTEGER NOT NULL DEFAULT 0,
    "eligible_seconds" INTEGER NOT NULL DEFAULT 0,
    "confidence" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "reconciliation_status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "finalized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_logged_minutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_requests" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scheduled_shift_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "calculated_minutes" INTEGER NOT NULL,
    "requested_minutes" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "attachment_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "reviewer_user_id" TEXT,
    "decision_note" TEXT,
    "applied_minutes" INTEGER,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "presence_intervals_scheduled_shift_id_membership_id_idx" ON "presence_intervals"("scheduled_shift_id", "membership_id");

-- CreateIndex
CREATE INDEX "presence_intervals_scheduled_shift_id_roblox_user_id_open_idx" ON "presence_intervals"("scheduled_shift_id", "roblox_user_id", "open");

-- CreateIndex
CREATE INDEX "shift_logged_minutes_organization_id_membership_id_idx" ON "shift_logged_minutes"("organization_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_logged_minutes_scheduled_shift_id_membership_id_key" ON "shift_logged_minutes"("scheduled_shift_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "correction_requests_public_id_key" ON "correction_requests"("public_id");

-- CreateIndex
CREATE INDEX "correction_requests_organization_id_membership_id_idx" ON "correction_requests"("organization_id", "membership_id");

-- AddForeignKey
ALTER TABLE "presence_intervals" ADD CONSTRAINT "presence_intervals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_logged_minutes" ADD CONSTRAINT "shift_logged_minutes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

