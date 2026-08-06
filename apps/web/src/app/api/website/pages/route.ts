import { NextResponse } from "next/server";
import { z } from "zod";
import { createPage, listPages } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "website.builder");
    const pages = await listPages({ actor, organizationId });
    return NextResponse.json({ pages });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "website.builder");
    const parsed = z
      .object({ title: z.string().min(2).max(120), slug: z.string().optional() })
      .safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("A page title is required");
    const page = await createPage({ actor, organizationId, ...parsed.data });
    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
