import { NextResponse } from "next/server";
import { PENAL_CODE } from "@commandry/cad";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

export async function GET() {
  try {
    await requireActiveOrganization();
    return NextResponse.json({ penalCode: PENAL_CODE });
  } catch (error) {
    return handleRouteError(error);
  }
}
