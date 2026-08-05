-- CreateEnum
CREATE TYPE "CadUnitType" AS ENUM ('POLICE', 'SHERIFF', 'STATE', 'FIRE', 'EMS', 'DISPATCH');

-- CreateEnum
CREATE TYPE "CadUnitStatus" AS ENUM ('AVAILABLE', 'BUSY', 'EN_ROUTE', 'ON_SCENE', 'PANIC', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "CadLicenseStatus" AS ENUM ('VALID', 'SUSPENDED', 'REVOKED', 'EXPIRED', 'NONE');

-- CreateEnum
CREATE TYPE "CadRegistrationStatus" AS ENUM ('VALID', 'EXPIRED', 'SUSPENDED', 'NONE');

-- CreateEnum
CREATE TYPE "CadWarrantStatus" AS ENUM ('ACTIVE', 'CLEARED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CadRecordType" AS ENUM ('CITATION', 'ARREST', 'INCIDENT', 'WARNING');

-- CreateEnum
CREATE TYPE "CadBoloType" AS ENUM ('PERSON', 'VEHICLE');

-- CreateEnum
CREATE TYPE "CadBoloStatus" AS ENUM ('ACTIVE', 'CLEARED');

-- AlterEnum
ALTER TYPE "CadCallStatus" ADD VALUE 'DISPATCHED';

-- AlterTable
ALTER TABLE "cad_calls" ADD COLUMN     "created_by_user_id" TEXT,
ADD COLUMN     "postal" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "type" TEXT;

-- CreateTable
CREATE TABLE "cad_units" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "callsign" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CadUnitType" NOT NULL DEFAULT 'POLICE',
    "status" "CadUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "user_id" TEXT,
    "roblox_username" TEXT,
    "on_duty_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_status_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cad_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cad_call_units" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cad_call_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cad_call_logs" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "author_user_id" TEXT,
    "author_name" TEXT,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cad_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cad_civilians" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3),
    "gender" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "license_status" "CadLicenseStatus" NOT NULL DEFAULT 'VALID',
    "roblox_username" TEXT,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cad_civilians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cad_vehicles" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "color" TEXT,
    "owner_id" TEXT,
    "registration" "CadRegistrationStatus" NOT NULL DEFAULT 'VALID',
    "insurance" "CadRegistrationStatus" NOT NULL DEFAULT 'VALID',
    "stolen" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cad_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cad_warrants" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "civilian_id" TEXT NOT NULL,
    "status" "CadWarrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "charges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reason" TEXT NOT NULL,
    "issued_by_name" TEXT,
    "issued_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cleared_at" TIMESTAMP(3),

    CONSTRAINT "cad_warrants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cad_records" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "civilian_id" TEXT,
    "type" "CadRecordType" NOT NULL DEFAULT 'CITATION',
    "title" TEXT NOT NULL,
    "charges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "officer_name" TEXT,
    "officer_user_id" TEXT,
    "fine_amount" INTEGER,
    "narrative" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cad_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cad_bolos" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "CadBoloType" NOT NULL DEFAULT 'PERSON',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "plate" TEXT,
    "status" "CadBoloStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_name" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cad_bolos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cad_units_public_id_key" ON "cad_units"("public_id");

-- CreateIndex
CREATE INDEX "cad_units_organization_id_status_idx" ON "cad_units"("organization_id", "status");

-- CreateIndex
CREATE INDEX "cad_call_units_unit_id_idx" ON "cad_call_units"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "cad_call_units_call_id_unit_id_key" ON "cad_call_units"("call_id", "unit_id");

-- CreateIndex
CREATE INDEX "cad_call_logs_call_id_created_at_idx" ON "cad_call_logs"("call_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cad_civilians_public_id_key" ON "cad_civilians"("public_id");

-- CreateIndex
CREATE INDEX "cad_civilians_organization_id_last_name_idx" ON "cad_civilians"("organization_id", "last_name");

-- CreateIndex
CREATE UNIQUE INDEX "cad_vehicles_public_id_key" ON "cad_vehicles"("public_id");

-- CreateIndex
CREATE INDEX "cad_vehicles_organization_id_plate_idx" ON "cad_vehicles"("organization_id", "plate");

-- CreateIndex
CREATE UNIQUE INDEX "cad_warrants_public_id_key" ON "cad_warrants"("public_id");

-- CreateIndex
CREATE INDEX "cad_warrants_organization_id_status_idx" ON "cad_warrants"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cad_records_public_id_key" ON "cad_records"("public_id");

-- CreateIndex
CREATE INDEX "cad_records_organization_id_type_idx" ON "cad_records"("organization_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "cad_bolos_public_id_key" ON "cad_bolos"("public_id");

-- CreateIndex
CREATE INDEX "cad_bolos_organization_id_status_idx" ON "cad_bolos"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "cad_units" ADD CONSTRAINT "cad_units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_call_units" ADD CONSTRAINT "cad_call_units_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "cad_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_call_units" ADD CONSTRAINT "cad_call_units_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "cad_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_call_logs" ADD CONSTRAINT "cad_call_logs_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "cad_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_civilians" ADD CONSTRAINT "cad_civilians_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_vehicles" ADD CONSTRAINT "cad_vehicles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_vehicles" ADD CONSTRAINT "cad_vehicles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "cad_civilians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_warrants" ADD CONSTRAINT "cad_warrants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_warrants" ADD CONSTRAINT "cad_warrants_civilian_id_fkey" FOREIGN KEY ("civilian_id") REFERENCES "cad_civilians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_records" ADD CONSTRAINT "cad_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_records" ADD CONSTRAINT "cad_records_civilian_id_fkey" FOREIGN KEY ("civilian_id") REFERENCES "cad_civilians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_bolos" ADD CONSTRAINT "cad_bolos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
