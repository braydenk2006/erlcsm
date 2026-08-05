import { NextResponse } from "next/server";
import { z } from "zod";
import {
  confirmRobloxVerification,
  getRobloxStatus,
  startRobloxVerification,
  unlinkRoblox,
} from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const postSchema = z.union([
  z.object({ action: z.literal("start"), username: z.string().min(3).max(30) }),
  z.object({ action: z.literal("confirm") }),
]);

export async function GET() {
  try {
    const { userId, organizationId } = await requireActor();
    await requireFeature(organizationId, "roblox.account_linking");
    return NextResponse.json(await getRobloxStatus(userId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { userId, organizationId } = await requireActor();
    await requireFeature(organizationId, "roblox.account_linking");
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid request");
    if (parsed.data.action === "start") {
      const challenge = await startRobloxVerification({
        userId,
        organizationId,
        username: parsed.data.username,
      });
      return NextResponse.json({ challenge });
    }
    const linked = await confirmRobloxVerification({ userId, organizationId });
    return NextResponse.json({ linked });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE() {
  try {
    const { userId, organizationId } = await requireActor();
    await requireFeature(organizationId, "roblox.account_linking");
    await unlinkRoblox({ userId, organizationId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
