import { NextResponse } from "next/server";
import { z } from "zod";
import { getErlcClientForOrganization } from "@commandry/integrations";
import { recordAuditEvent } from "@commandry/audit";
import { ValidationError } from "@commandry/shared";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

const bodySchema = z.object({
  command: z.string().min(1).max(200),
});

/** Execute a remote ER:LC server command and write an audit trail entry. */
export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await requireActiveOrganization();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ValidationError("A command string is required");
    }

    const { client } = await getErlcClientForOrganization(organizationId);
    const result = await client.runCommand(parsed.data.command);

    await recordAuditEvent({
      organizationId,
      actorUserId: userId,
      action: "erlc:command",
      resourceType: "erlc_server",
      source: "ERLC",
      metadata: { command: parsed.data.command, ok: result.ok },
    }).catch(() => undefined);

    return NextResponse.json({ ok: result.ok, result });
  } catch (error) {
    return handleRouteError(error);
  }
}
