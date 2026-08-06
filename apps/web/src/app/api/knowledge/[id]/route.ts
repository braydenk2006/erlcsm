import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteArticle,
  getArticle,
  rollbackArticle,
  transitionArticle,
  updateArticle,
} from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    return NextResponse.json(await getArticle({ actor, organizationId, idOrSlug: id }));
  } catch (error) {
    return handleRouteError(error);
  }
}

const patchSchema = z.object({
  action: z.enum(["update", "transition", "rollback"]),
  title: z.string().optional(),
  body: z.string().optional(),
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  visibility: z.enum(["organization", "department", "staff", "public"]).optional(),
  category: z.string().optional(),
  changeSummary: z.string().optional(),
  to: z
    .enum(["draft", "review", "approved", "published", "archived", "superseded", "expired"])
    .optional(),
  toVersion: z.number().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid update");
    const d = parsed.data;
    if (d.action === "transition") {
      if (!d.to) throw new ValidationError("Missing target status");
      return NextResponse.json({
        article: await transitionArticle({ actor, organizationId, id, to: d.to }),
      });
    }
    if (d.action === "rollback") {
      if (d.toVersion === undefined) throw new ValidationError("Missing version");
      return NextResponse.json({
        article: await rollbackArticle({ actor, organizationId, id, toVersion: d.toVersion }),
      });
    }
    return NextResponse.json({
      article: await updateArticle({
        actor,
        organizationId,
        id,
        title: d.title,
        body: d.body,
        tags: d.tags,
        keywords: d.keywords,
        visibility: d.visibility,
        category: d.category,
        changeSummary: d.changeSummary,
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    await deleteArticle({ actor, organizationId, id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
