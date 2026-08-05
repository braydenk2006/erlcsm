import { NextResponse } from "next/server";
import { recordErlcCallWebhook } from "@commandry/integrations";
import { resolveOrganizationByPublicId } from "@/lib/organization";

export const dynamic = "force-dynamic";

/**
 * Inbound ER:LC / CAD emergency-call webhook. The org is identified by its
 * public id in the path; the raw body is HMAC-verified against the org's stored
 * webhook secret before any write. No session is required (external caller).
 */
export async function POST(request: Request, context: { params: Promise<{ org: string }> }) {
  const { org } = await context.params;
  const organization = await resolveOrganizationByPublicId(org);
  if (!organization) {
    return NextResponse.json({ error: "Unknown organization" }, { status: 404 });
  }

  const rawBody = await request.text();
  const signature =
    request.headers.get("x-signature") ?? request.headers.get("x-ordinex-signature");

  const result = await recordErlcCallWebhook({
    organizationId: organization.id,
    rawBody,
    signature,
  });

  if (!result.ok) {
    const status = result.reason === "invalid signature" ? 401 : 400;
    return NextResponse.json({ ok: false, reason: result.reason }, { status });
  }

  return NextResponse.json({ ok: true });
}
