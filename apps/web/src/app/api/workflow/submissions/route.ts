import { NextResponse } from "next/server";
import { z } from "zod";
import { createDraft, listSubmissions } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const createSchema = z.object({ templateId: z.string() });

export async function GET(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "forms.basic");
    const url = new URL(request.url);
    const scope = (url.searchParams.get("scope") as "mine" | "assigned" | "all" | null) ?? "mine";
    const submissions = await listSubmissions({
      actor,
      organizationId,
      category: url.searchParams.get("category") ?? undefined,
      scope,
    });
    return NextResponse.json({ submissions });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "forms.basic");
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("A template is required");
    const draft = await createDraft({ actor, organizationId, templateId: parsed.data.templateId });
    return NextResponse.json({ id: draft.id }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
