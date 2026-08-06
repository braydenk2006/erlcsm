-- CreateTable
CREATE TABLE "kpi_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kpi_key" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insight_records" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "current" DOUBLE PRECISION,
    "previous" DOUBLE PRECISION,
    "trend" TEXT,
    "recommendation" TEXT,
    "evidence" TEXT,
    "department_id" TEXT,
    "day" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insight_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metric_key" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'organization',
    "department_id" TEXT,
    "role_key" TEXT,
    "baseline" DOUBLE PRECISION,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "due_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "insight_key" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "department_id" TEXT,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "day" TEXT NOT NULL,
    "acknowledged_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kpi_snapshots_organization_id_kpi_key_idx" ON "kpi_snapshots"("organization_id", "kpi_key");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_snapshots_organization_id_kpi_key_day_key" ON "kpi_snapshots"("organization_id", "kpi_key", "day");

-- CreateIndex
CREATE UNIQUE INDEX "insight_records_public_id_key" ON "insight_records"("public_id");

-- CreateIndex
CREATE INDEX "insight_records_organization_id_category_severity_idx" ON "insight_records"("organization_id", "category", "severity");

-- CreateIndex
CREATE INDEX "insight_records_organization_id_created_at_idx" ON "insight_records"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "insight_records_organization_id_key_day_key" ON "insight_records"("organization_id", "key", "day");

-- CreateIndex
CREATE UNIQUE INDEX "goals_public_id_key" ON "goals"("public_id");

-- CreateIndex
CREATE INDEX "goals_organization_id_status_idx" ON "goals"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_public_id_key" ON "alerts"("public_id");

-- CreateIndex
CREATE INDEX "alerts_organization_id_status_idx" ON "alerts"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_organization_id_insight_key_day_key" ON "alerts"("organization_id", "insight_key", "day");

-- AddForeignKey
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insight_records" ADD CONSTRAINT "insight_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

