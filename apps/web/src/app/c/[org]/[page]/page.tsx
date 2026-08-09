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
  params: Promise<{ org: string; page: string }>;
}): Promise<Metadata> {
  const { org, page: pageSlug } = await params;
  const baseUrl = await getBaseUrl();
  const page = await getPublicPage({ orgSlug: org, pageSlug, baseUrl });
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

export default async function PublicPage({
  params,
}: {
  params: Promise<{ org: string; page: string }>;
}) {
  const { org, page: pageSlug } = await params;
  const baseUrl = await getBaseUrl();
  const [site, page] = await Promise.all([
    getPublicSite(org),
    getPublicPage({ orgSlug: org, pageSlug, baseUrl }),
  ]);
  if (!site || !page) notFound();
  void recordWebsiteVisit(org, pageSlug).catch(() => undefined);
  return (
    <PublicShell site={site}>
      <h1 className="mb-8 font-[family-name:var(--site-font-heading)] text-3xl font-bold">
        {page.title}
      </h1>
      <RenderBlocks blocks={page.blocks} />
    </PublicShell>
  );
}
