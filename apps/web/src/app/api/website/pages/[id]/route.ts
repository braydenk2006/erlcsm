import { NextResponse } from "next/server";
import { z } from "zod";
import { deletePage, updatePage } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const blockSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  config: z.record(z.string(), z.unknown()).optional(),
  visibility: z.string().optional(),
  roleKeys: z.array(z.string()).optional(),
});

const patchSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"]).optional(),
  visibility: z.enum(["PUBLIC", "MEMBERS", "AUTHENTICATED", "ROLES"]).optional(),
  blocks: z.array(blockSchema).optional(),
  seo: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      noindex: z.boolean().optional(),
    })
    .optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "website.builder");
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid page update");
    const d = parsed.data;
    await updatePage({
      actor,
      organizationId,
      id,
      title: d.title,
      status: d.status,
      visibility: d.visibility,
      blocks: d.blocks?.map((b) => ({
        id: b.id ?? `blk_${Math.random().toString(36).slice(2, 10)}`,
        type: b.type as never,
        config: b.config ?? {},
        visibility: (b.visibility ?? "PUBLIC") as never,
        ...(b.roleKeys ? { roleKeys: b.roleKeys } : {}),
      })),
      seo: d.seo,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "website.builder");
    const { id } = await params;
    await deletePage({ actor, organizationId, id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
