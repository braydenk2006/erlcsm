import { getPublicSitemap } from "@commandry/api";
import { getBaseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const baseUrl = await getBaseUrl();
  const xml = await getPublicSitemap(org, baseUrl);
  if (!xml) return new Response("Not found", { status: 404 });
  return new Response(xml, { headers: { "content-type": "application/xml" } });
}
