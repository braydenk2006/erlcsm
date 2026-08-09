import { NextResponse } from "next/server";
import { authenticateApiKey } from "@commandry/api";
import { prisma } from "@commandry/database";

export const dynamic = "force-dynamic";

// Sample public API endpoint — authenticated by an Ordinex API key with the
// `members.read` scope, tenant-bound to the key's organization. Demonstrates the
// API-key architecture; the full public API surface is a follow-up.
export async function GET(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const rawKey = header.startsWith("Bearer ") ? header.slice(7) : header;
  const auth = await authenticateApiKey(rawKey, "members.read");
  if (!auth) {
    return NextResponse.json(
      { error: "Invalid API key or missing members.read scope" },
      { status: 401 },
    );
  }
  const members = await prisma.membership.findMany({
    where: { organizationId: auth.organizationId, status: "ACTIVE" },
    select: {
      publicId: true,
      title: true,
      user: { select: { name: true } },
      roles: { select: { role: { select: { key: true } } } },
    },
    take: 200,
  });
  return NextResponse.json({
    organizationId: auth.organizationId,
    members: members.map((m) => ({
      id: m.publicId,
      name: m.user.name,
      title: m.title,
      roles: m.roles.map((r) => r.role.key),
    })),
  });
}
