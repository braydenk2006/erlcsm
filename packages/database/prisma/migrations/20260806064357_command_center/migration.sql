-- CreateTable
CREATE TABLE "dashboard_preferences" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "layout" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "overall" INTEGER NOT NULL,
    "factors" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_preferences_organization_id_user_id_key" ON "dashboard_preferences"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "health_snapshots_organization_id_day_key" ON "health_snapshots"("organization_id", "day");

-- AddForeignKey
ALTER TABLE "dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_snapshots" ADD CONSTRAINT "health_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

