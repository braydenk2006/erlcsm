import { NextResponse } from "next/server";
import { z } from "zod";
import { getWebsiteSettings, updateWebsiteSettings } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  published: z.boolean().optional(),
  branding: z
    .object({
      name: z.string().max(120).optional(),
      description: z.string().max(500).optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      logoUrl: z.string().url().optional(),
      discordInvite: z.string().url().optional(),
      robloxGroup: z.string().url().optional(),
    })
    .partial()
    .optional(),
});

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "website.builder");
    return NextResponse.json(await getWebsiteSettings({ actor, organizationId }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "website.builder");
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid settings");
    await updateWebsiteSettings({ actor, organizationId, ...parsed.data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
