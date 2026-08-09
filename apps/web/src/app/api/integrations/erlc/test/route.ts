import { NextResponse } from "next/server";
import { checkErlcHealth, getErlcIntegration } from "@commandry/integrations";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

/** Run an on-demand ER:LC health check and persist the result. */
export async function POST() {
  try {
    const { organizationId } = await requireActiveOrganization();
    const health = await checkErlcHealth(organizationId);
    const integration = await getErlcIntegration(organizationId);
    return NextResponse.json({ health, integration });
  } catch (error) {
    return handleRouteError(error);
  }
}
