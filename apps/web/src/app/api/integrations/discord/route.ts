import { NextResponse } from "next/server";
import { z } from "zod";
import {
  connectDiscordIntegration,
  getDiscordConfig,
  testDiscord,
  updateDiscordConfig,
} from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "discord.integration");
    return NextResponse.json(await getDiscordConfig({ actor, organizationId }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "discord.integration");
    const body = await request.json();
    if (body?.action === "test") {
      return NextResponse.json(await testDiscord({ actor, organizationId }));
    }
    const parsed = z
      .object({
        botToken: z.string().min(10),
        guildId: z.string().min(2),
        label: z.string().optional(),
      })
      .safeParse(body);
    if (!parsed.success) throw new ValidationError("Invalid Discord credentials");
    await connectDiscordIntegration({ actor, organizationId, ...parsed.data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "discord.integration");
    const parsed = z
      .object({
        channels: z.record(z.string(), z.string()).optional(),
        roles: z.record(z.string(), z.string()).optional(),
      })
      .safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid configuration");
    await updateDiscordConfig({ actor, organizationId, ...parsed.data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
