import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicPage, getPublicSite, recordWebsiteVisit } from "@commandry/api";
import { PublicShell } from "@/components/public-site/public-shell";
import { RenderBlocks } from "@/components/public-site/render-blocks";
import { getBaseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ org: string }>;
}): Promise<Metadata> {
  const { org } = await params;
  const baseUrl = await getBaseUrl();
  const page = await getPublicPage({ orgSlug: org, pageSlug: "home", baseUrl });
  if (!page) return { title: "Not found" };
  return {
    title: page.meta.title,
    description: page.meta.description,
    alternates: { canonical: page.meta.canonical },
    robots: page.meta.noindex ? { index: false } : undefined,
    openGraph: {
      title: page.meta.title,
      description: page.meta.description,
      images: page.meta.ogImage ? [page.meta.ogImage] : undefined,
    },
  };
}

export default async function PublicHome({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const baseUrl = await getBaseUrl();
  const [site, page] = await Promise.all([
    getPublicSite(org),
    getPublicPage({ orgSlug: org, pageSlug: "home", baseUrl }),
  ]);
  if (!site || !page) notFound();
  void recordWebsiteVisit(org, "home").catch(() => undefined);
  return (
    <PublicShell site={site}>
      <RenderBlocks blocks={page.blocks} />
    </PublicShell>
  );
}
