import "dotenv/config";
import { createPublicId } from "@commandry/shared";
import { prisma } from "./client";

const SYSTEM_ROLES = [
  {
    key: "owner",
    name: "Owner",
    description: "Full organization control",
  },
  {
    key: "admin",
    name: "Administrator",
    description: "Administrative access without ownership transfer",
  },
  {
    key: "moderator",
    name: "Moderator",
    description: "Moderation and live-server visibility",
  },
  {
    key: "staff",
    name: "Staff",
    description: "Operational staff access",
  },
  {
    key: "member",
    name: "Member",
    description: "Baseline community membership",
  },
] as const;

async function main() {
  // Seed is intentionally minimal and development-oriented.
  // No fabricated production organizations are created.
  console.warn("Commandry seed: ensuring reference integrity helpers are available.");

  const count = await prisma.organization.count();
  console.warn(`Organizations currently in database: ${count}`);
  console.warn(`System role templates: ${SYSTEM_ROLES.map((role) => role.key).join(", ")}`);
  console.warn(`Example public id format: ${createPublicId("org")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export { SYSTEM_ROLES };
