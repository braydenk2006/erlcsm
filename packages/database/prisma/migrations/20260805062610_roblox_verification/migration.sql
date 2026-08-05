-- CreateTable
CREATE TABLE "roblox_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "roblox_user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roblox_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roblox_verifications_user_id_key" ON "roblox_verifications"("user_id");

-- AddForeignKey
ALTER TABLE "roblox_verifications" ADD CONSTRAINT "roblox_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

