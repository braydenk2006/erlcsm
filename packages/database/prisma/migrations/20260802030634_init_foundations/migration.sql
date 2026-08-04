-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'SUPPORT', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('PRIVATE_SERVER', 'ROLEPLAY', 'DEPARTMENT_HEAVY', 'LAW_ENFORCEMENT', 'BORDER_ROLEPLAY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ApproximateSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'READ_ONLY', 'PENDING_DELETION', 'DELETED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'FORMER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AuditSource" AS ENUM ('WEB', 'API', 'DISCORD', 'AUTOMATION', 'ERLC', 'PLATFORM_SUPPORT', 'SYSTEM', 'WORKER');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'DEGRADED', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "active_organization_id" TEXT,
    "platform_role" "PlatformRole" NOT NULL DEFAULT 'NONE',
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,
    "active_organization_id" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roblox_identities" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "roblox_user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "verified_at" TIMESTAMP(3) NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roblox_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discord_identities" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "global_name" TEXT,
    "avatar_url" TEXT,
    "verified_at" TIMESTAMP(3) NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "organization_type" "OrganizationType" NOT NULL DEFAULT 'CUSTOM',
    "approximate_size" "ApproximateSize" NOT NULL DEFAULT 'SMALL',
    "accent_color" TEXT NOT NULL DEFAULT '#0F766E',
    "logo_url" TEXT,
    "terminology" JSONB NOT NULL DEFAULT '{}',
    "enabled_modules" TEXT[] DEFAULT ARRAY['home', 'people', 'staff', 'departments', 'sessions', 'activity', 'settings']::TEXT[],
    "onboarding_step" INTEGER NOT NULL DEFAULT 0,
    "onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
    "plan_key" TEXT NOT NULL DEFAULT 'free',
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_domains" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "rank_id" TEXT,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role_key" TEXT NOT NULL DEFAULT 'member',
    "token_hash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "invited_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_roles" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranks" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "is_staff" BOOLEAN NOT NULL DEFAULT true,
    "discord_role_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ranks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "accent_color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_members" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "title" TEXT,
    "is_leader" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_grants" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL DEFAULT 'organization',
    "scope_id" TEXT,
    "reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_denials" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_denials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "break_glass_sessions" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "break_glass_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "request_id" TEXT,
    "source" "AuditSource" NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "last_checked_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "last_error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_access_sessions" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_access_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours_start" INTEGER,
    "quiet_hours_end" INTEGER,
    "module_overrides" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_failures" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "job_id" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_public_id_key" ON "users"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_id_account_id_key" ON "accounts"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "roblox_identities_public_id_key" ON "roblox_identities"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "roblox_identities_user_id_key" ON "roblox_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "roblox_identities_roblox_user_id_key" ON "roblox_identities"("roblox_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "discord_identities_public_id_key" ON "discord_identities"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "discord_identities_user_id_key" ON "discord_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "discord_identities_discord_user_id_key" ON "discord_identities"("discord_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_public_id_key" ON "organizations"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "organizations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_domains_domain_key" ON "organization_domains"("domain");

-- CreateIndex
CREATE INDEX "organization_domains_organization_id_idx" ON "organization_domains"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_public_id_key" ON "memberships"("public_id");

-- CreateIndex
CREATE INDEX "memberships_organization_id_status_idx" ON "memberships"("organization_id", "status");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_organization_id_user_id_key" ON "memberships"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_public_id_key" ON "invitations"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_organization_id_email_idx" ON "invitations"("organization_id", "email");

-- CreateIndex
CREATE INDEX "invitations_organization_id_status_idx" ON "invitations"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_public_id_key" ON "roles"("public_id");

-- CreateIndex
CREATE INDEX "roles_organization_id_idx" ON "roles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_key_key" ON "roles"("organization_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "membership_roles_membership_id_role_id_key" ON "membership_roles"("membership_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "ranks_public_id_key" ON "ranks"("public_id");

-- CreateIndex
CREATE INDEX "ranks_organization_id_idx" ON "ranks"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "ranks_organization_id_name_key" ON "ranks"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ranks_organization_id_order_key" ON "ranks"("organization_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "departments_public_id_key" ON "departments"("public_id");

-- CreateIndex
CREATE INDEX "departments_organization_id_is_active_idx" ON "departments"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "departments_organization_id_slug_key" ON "departments"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "department_members_membership_id_idx" ON "department_members"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_members_department_id_membership_id_key" ON "department_members"("department_id", "membership_id");

-- CreateIndex
CREATE INDEX "permission_grants_membership_id_action_idx" ON "permission_grants"("membership_id", "action");

-- CreateIndex
CREATE INDEX "permission_denials_membership_id_action_idx" ON "permission_denials"("membership_id", "action");

-- CreateIndex
CREATE INDEX "break_glass_sessions_membership_id_ends_at_idx" ON "break_glass_sessions"("membership_id", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_public_id_key" ON "audit_events"("public_id");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_created_at_idx" ON "audit_events"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_resource_type_resource_id_idx" ON "audit_events"("organization_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_created_at_idx" ON "audit_events"("actor_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "integration_credentials_public_id_key" ON "integration_credentials"("public_id");

-- CreateIndex
CREATE INDEX "integration_credentials_organization_id_idx" ON "integration_credentials"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_credentials_organization_id_provider_key" ON "integration_credentials"("organization_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "support_access_sessions_public_id_key" ON "support_access_sessions"("public_id");

-- CreateIndex
CREATE INDEX "support_access_sessions_organization_id_ends_at_idx" ON "support_access_sessions"("organization_id", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_organization_id_user_id_channel_key" ON "notification_preferences"("organization_id", "user_id", "channel");

-- CreateIndex
CREATE INDEX "job_failures_queue_created_at_idx" ON "job_failures"("queue", "created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roblox_identities" ADD CONSTRAINT "roblox_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discord_identities" ADD CONSTRAINT "discord_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_domains" ADD CONSTRAINT "organization_domains_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_rank_id_fkey" FOREIGN KEY ("rank_id") REFERENCES "ranks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranks" ADD CONSTRAINT "ranks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_denials" ADD CONSTRAINT "permission_denials_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "break_glass_sessions" ADD CONSTRAINT "break_glass_sessions_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_access_sessions" ADD CONSTRAINT "support_access_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_access_sessions" ADD CONSTRAINT "support_access_sessions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
