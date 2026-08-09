-- CreateEnum
CREATE TYPE "CadWarrantState" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'ACTIVE', 'SERVED', 'EXPIRED', 'RECALLED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "CadRecordStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'LOCKED', 'ARCHIVED');

-- DropIndex
DROP INDEX "cad_vehicles_organization_id_plate_idx";

-- DropIndex
DROP INDEX "cad_warrants_organization_id_status_idx";

-- AlterTable
ALTER TABLE "cad_bolos" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "cad_records" ADD COLUMN     "additional_authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "locked_at" TIMESTAMP(3),
ADD COLUMN     "record_number" TEXT,
ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "reviewed_by_user_id" TEXT,
ADD COLUMN     "status" "CadRecordStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "cad_settings" ADD COLUMN     "record_sequence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warrant_sequence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "cad_warrants" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "reviewed_by_user_id" TEXT,
ADD COLUMN     "scope" TEXT,
ADD COLUMN     "state" "CadWarrantState" NOT NULL DEFAULT 'SUBMITTED',
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'arrest',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warrant_number" TEXT;

-- CreateTable
CREATE TABLE "cad_status_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cad_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cad_penal_charges" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "class" TEXT NOT NULL DEFAULT 'Misdemeanor',
    "fine" INTEGER NOT NULL DEFAULT 0,
    "jail_minutes" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "is_attempt" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effective_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cad_penal_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cad_status_events_organization_id_subject_type_subject_id_idx" ON "cad_status_events"("organization_id", "subject_type", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "cad_penal_charges_public_id_key" ON "cad_penal_charges"("public_id");

-- CreateIndex
CREATE INDEX "cad_penal_charges_organization_id_active_idx" ON "cad_penal_charges"("organization_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "cad_penal_charges_organization_id_code_key" ON "cad_penal_charges"("organization_id", "code");

-- CreateIndex
CREATE INDEX "cad_bolos_organization_id_expires_at_idx" ON "cad_bolos"("organization_id", "expires_at");

-- CreateIndex
CREATE INDEX "cad_records_organization_id_status_idx" ON "cad_records"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cad_units_organization_id_callsign_key" ON "cad_units"("organization_id", "callsign");

-- CreateIndex
CREATE UNIQUE INDEX "cad_vehicles_organization_id_plate_key" ON "cad_vehicles"("organization_id", "plate");

-- CreateIndex
CREATE INDEX "cad_warrants_organization_id_state_idx" ON "cad_warrants"("organization_id", "state");

-- CreateIndex
CREATE INDEX "cad_warrants_organization_id_expires_at_idx" ON "cad_warrants"("organization_id", "expires_at");

-- AddForeignKey
ALTER TABLE "cad_status_events" ADD CONSTRAINT "cad_status_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_penal_charges" ADD CONSTRAINT "cad_penal_charges_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Data backfill (M2): preserve legacy semantics of already-filed records/warrants.
-- Existing records were created as final filings -> mark APPROVED + locked.
UPDATE "cad_records" SET "status" = 'APPROVED', "locked_at" = now() WHERE "status" = 'DRAFT';
-- Map legacy warrant status onto the new lifecycle state.
UPDATE "cad_warrants" SET "state" = 'ACTIVE' WHERE "status" = 'ACTIVE';
UPDATE "cad_warrants" SET "state" = 'DISMISSED' WHERE "status" = 'CLEARED';
UPDATE "cad_warrants" SET "state" = 'EXPIRED' WHERE "status" = 'EXPIRED';
