import { NextResponse } from "next/server";
import { z } from "zod";
import { createTemplate, listTemplates } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const fieldSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
});

const createSchema = z.object({
  name: z.string().min(2).max(120),
  category: z.string().max(40),
  description: z.string().max(500).optional(),
  form: z.object({ fields: z.array(fieldSchema) }),
  workflow: z.object({
    initialStageId: z.string(),
    stages: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        approvalMode: z.enum(["SINGLE", "ALL", "ANY", "AUTO"]),
        assignment: z.object({ strategy: z.string(), target: z.string().nullable().optional() }),
        onApprove: z.string(),
        allowRevision: z.boolean().optional(),
      }),
    ),
  }),
  submitRoleKeys: z.array(z.string()).optional(),
  reviewRoleKeys: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "forms.basic");
    const category = new URL(request.url).searchParams.get("category") ?? undefined;
    const templates = await listTemplates({ actor, organizationId, category });
    return NextResponse.json({ templates });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "forms.basic");
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid template");
    const template = await createTemplate({ actor, organizationId, ...parsed.data } as never);
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
