import { getPublicRobots } from "@commandry/api";
import { getBaseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const baseUrl = await getBaseUrl();
  const txt = await getPublicRobots(org, baseUrl);
  return new Response(txt, { headers: { "content-type": "text/plain" } });
}
