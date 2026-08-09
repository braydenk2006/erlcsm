-- AlterTable
ALTER TABLE "cad_calls" ADD COLUMN     "agency_id" TEXT,
ADD COLUMN     "call_number" TEXT,
ADD COLUMN     "call_sequence" INTEGER,
ADD COLUMN     "cleared_at" TIMESTAMP(3),
ADD COLUMN     "dispatched_at" TIMESTAMP(3),
ADD COLUMN     "disposition" TEXT,
ADD COLUMN     "en_route_at" TIMESTAMP(3),
ADD COLUMN     "on_scene_at" TIMESTAMP(3),
ADD COLUMN     "street" TEXT;

-- AlterTable
ALTER TABLE "cad_units" ADD COLUMN     "agency_id" TEXT,
ADD COLUMN     "division" TEXT,
ADD COLUMN     "location_text" TEXT,
ADD COLUMN     "membership_id" TEXT;

-- CreateTable
CREATE TABLE "cad_agencies" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "type" "CadUnitType" NOT NULL DEFAULT 'POLICE',
    "department_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cad_agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cad_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "default_landing" TEXT NOT NULL DEFAULT 'dispatch',
    "enabled_sections" TEXT[] DEFAULT ARRAY['command', 'dispatch', 'mdt', 'units', 'calls', 'persons', 'vehicles', 'records', 'warrants', 'bolos']::TEXT[],
    "call_number_prefix" TEXT,
    "call_sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cad_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cad_agencies_public_id_key" ON "cad_agencies"("public_id");

-- CreateIndex
CREATE INDEX "cad_agencies_organization_id_idx" ON "cad_agencies"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "cad_settings_organization_id_key" ON "cad_settings"("organization_id");

-- AddForeignKey
ALTER TABLE "cad_units" ADD CONSTRAINT "cad_units_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "cad_agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_agencies" ADD CONSTRAINT "cad_agencies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_agencies" ADD CONSTRAINT "cad_agencies_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_settings" ADD CONSTRAINT "cad_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
