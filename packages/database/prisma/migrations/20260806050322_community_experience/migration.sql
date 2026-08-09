-- CreateTable
CREATE TABLE "website_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branding" JSONB NOT NULL DEFAULT '{}',
    "theme" JSONB NOT NULL DEFAULT '{}',
    "nav" JSONB NOT NULL DEFAULT '[]',
    "seo" JSONB NOT NULL DEFAULT '{}',
    "public_toggles" JSONB NOT NULL DEFAULT '{}',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_pages" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "seo" JSONB NOT NULL DEFAULT '{}',
    "publish_at" TIMESTAMP(3),
    "system" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'image',
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "folder" TEXT,
    "size_bytes" INTEGER,
    "uploader_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_visits" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_settings_organization_id_key" ON "website_settings"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "website_pages_public_id_key" ON "website_pages"("public_id");

-- CreateIndex
CREATE INDEX "website_pages_organization_id_status_idx" ON "website_pages"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "website_pages_organization_id_slug_key" ON "website_pages"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_public_id_key" ON "media_assets"("public_id");

-- CreateIndex
CREATE INDEX "media_assets_organization_id_folder_idx" ON "media_assets"("organization_id", "folder");

-- CreateIndex
CREATE INDEX "website_visits_organization_id_day_idx" ON "website_visits"("organization_id", "day");

-- CreateIndex
CREATE UNIQUE INDEX "website_visits_organization_id_path_day_key" ON "website_visits"("organization_id", "path", "day");

-- AddForeignKey
ALTER TABLE "website_settings" ADD CONSTRAINT "website_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_pages" ADD CONSTRAINT "website_pages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_visits" ADD CONSTRAINT "website_visits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

