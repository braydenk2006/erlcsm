import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiKey, listApiKeys } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "api.public");
    return NextResponse.json({ apiKeys: await listApiKeys({ actor, organizationId }) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "api.public");
    const parsed = z
      .object({
        name: z.string().min(2).max(120),
        scopes: z.array(z.string()).min(1),
        expiresAt: z.string().optional(),
      })
      .safeParse(await request.json());
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid API key");
    const result = await createApiKey({
      actor,
      organizationId,
      name: parsed.data.name,
      scopes: parsed.data.scopes,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
