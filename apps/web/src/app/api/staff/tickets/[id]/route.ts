import { NextResponse } from "next/server";
import { z } from "zod";
import { assignTicket, setTicketStatus, staffGetTicket, staffReply } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireStaffUser } from "@/lib/staff";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireStaffUser();
    const { id } = await params;
    return NextResponse.json(await staffGetTicket({ staffUserId: userId, id }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireStaffUser();
    const { id } = await params;
    const parsed = z
      .object({
        action: z.enum(["reply", "note", "assign", "status"]),
        body: z.string().optional(),
        assigneeUserId: z.string().optional(),
        status: z.string().optional(),
      })
      .safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid action");
    const d = parsed.data;
    if (d.action === "reply" || d.action === "note") {
      if (!d.body) throw new ValidationError("Missing body");
      await staffReply({ staffUserId: userId, id, body: d.body, internal: d.action === "note" });
    } else if (d.action === "assign") {
      await assignTicket({ staffUserId: userId, id, assigneeUserId: d.assigneeUserId ?? userId });
    } else if (d.action === "status") {
      if (!d.status) throw new ValidationError("Missing status");
      await setTicketStatus({ staffUserId: userId, id, status: d.status as never });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
