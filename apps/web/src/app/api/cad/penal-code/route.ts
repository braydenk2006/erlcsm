import { NextResponse } from "next/server";
import { PENAL_CODE } from "@commandry/cad";
import { requireCadPermission } from "@/lib/cad-auth";
import { handleRouteError } from "@/lib/api";

export async function GET() {
  try {
    await requireCadPermission("cad.access");
    return NextResponse.json({ penalCode: PENAL_CODE });
  } catch (error) {
    return handleRouteError(error);
  }
}
