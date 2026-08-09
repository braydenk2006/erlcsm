-- CreateEnum
CREATE TYPE "CadCallStatus" AS ENUM ('PENDING', 'ACTIVE', 'CLOSED');

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "enabled_modules" SET DEFAULT ARRAY['home', 'live_server', 'people', 'staff', 'departments', 'moderation', 'sessions', 'activity', 'cad', 'integrations', 'settings']::TEXT[];

-- CreateTable
CREATE TABLE "erlc_player_sessions" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "roblox_user_id" TEXT NOT NULL,
    "roblox_username" TEXT NOT NULL,
    "callsign" TEXT,
    "team" TEXT,
    "last_wanted_stars" INTEGER,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_count" INTEGER NOT NULL DEFAULT 1,
    "total_minutes" INTEGER NOT NULL DEFAULT 0,
    "roblox_identity_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erlc_player_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cad_calls" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'erlc',
    "external_id" TEXT NOT NULL,
    "number" TEXT NOT NULL DEFAULT '911',
    "caller" TEXT NOT NULL,
    "caller_id" TEXT,
    "message" TEXT NOT NULL,
    "location" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "status" "CadCallStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_unit" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cad_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "erlc_player_sessions_public_id_key" ON "erlc_player_sessions"("public_id");

-- CreateIndex
CREATE INDEX "erlc_player_sessions_organization_id_last_seen_at_idx" ON "erlc_player_sessions"("organization_id", "last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "erlc_player_sessions_organization_id_roblox_user_id_key" ON "erlc_player_sessions"("organization_id", "roblox_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cad_calls_public_id_key" ON "cad_calls"("public_id");

-- CreateIndex
CREATE INDEX "cad_calls_organization_id_status_idx" ON "cad_calls"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cad_calls_organization_id_source_external_id_key" ON "cad_calls"("organization_id", "source", "external_id");

-- AddForeignKey
ALTER TABLE "erlc_player_sessions" ADD CONSTRAINT "erlc_player_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_calls" ADD CONSTRAINT "cad_calls_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
