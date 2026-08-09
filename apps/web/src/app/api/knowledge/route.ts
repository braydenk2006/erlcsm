import { NextResponse } from "next/server";
import { z } from "zod";
import { createArticle, listArticles } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const url = new URL(request.url);
    const articles = await listArticles({
      actor,
      organizationId,
      query: url.searchParams.get("query") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      collection: url.searchParams.get("collection") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    return NextResponse.json({ articles });
  } catch (error) {
    return handleRouteError(error);
  }
}

const createSchema = z.object({
  title: z.string().min(2).max(160),
  category: z.string(),
  collection: z.string().optional(),
  body: z.string().default(""),
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  visibility: z.enum(["organization", "department", "staff", "public"]).optional(),
  departmentId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid article");
    const article = await createArticle({ actor, organizationId, ...parsed.data });
    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
