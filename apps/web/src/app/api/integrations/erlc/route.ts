import { NextResponse } from "next/server";
import { z } from "zod";
import { connectErlc, disconnectErlc, getErlcIntegration } from "@commandry/integrations";
import { ValidationError } from "@commandry/shared";
import { requireActiveOrganization } from "@/lib/organization";
import { requireFeature, assertWithinLimit } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

const connectSchema = z.object({
  serverKey: z.string().min(6, "A valid ER:LC server key is required").max(256),
  globalKey: z.string().max(256).optional(),
  webhookSecret: z.string().min(8).max(256).optional(),
  label: z.string().max(80).optional(),
});

/** Current ER:LC integration status for the active org (no secrets returned). */
export async function GET() {
  try {
    const { organizationId } = await requireActiveOrganization();
    const integration = await getErlcIntegration(organizationId);
    return NextResponse.json({ integration });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Connect/update ER:LC credentials (stored AES-256-GCM encrypted at rest). */
export async function POST(request: Request) {
  try {
    const { organizationId } = await requireActiveOrganization();
    await requireFeature(organizationId, "server.health_monitoring");
    const existing = await getErlcIntegration(organizationId);
    // Only count against the ER:LC server limit when adding a new connection.
    if (!existing.hasCredentials) {
      await assertWithinLimit(organizationId, "erlc_servers.max");
    }
    const parsed = connectSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid credentials");
    }
    const integration = await connectErlc({ organizationId, ...parsed.data });
    return NextResponse.json({ integration }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Remove stored ER:LC credentials. */
export async function DELETE() {
  try {
    const { organizationId } = await requireActiveOrganization();
    await disconnectErlc(organizationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
