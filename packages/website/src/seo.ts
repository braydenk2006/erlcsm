import type { Branding, SeoMeta, WebsitePageDef } from "./index";

export type PageMeta = {
  title: string;
  description: string;
  ogImage?: string;
  canonical: string;
  noindex: boolean;
};

/** Resolve a page's SEO metadata, falling back to branding defaults. */
export function buildPageMeta(input: {
  branding: Branding;
  siteSeo: SeoMeta;
  page: Pick<WebsitePageDef, "title" | "slug" | "seo">;
  baseUrl: string;
  orgSlug: string;
}): PageMeta {
  const { branding, page, siteSeo } = input;
  const title = page.seo.title ?? `${page.title} · ${branding.name}`;
  const description =
    page.seo.description ?? siteSeo.description ?? branding.description ?? branding.name;
  const path = page.slug === "home" ? "" : `/${page.slug}`;
  return {
    title,
    description,
    ogImage: page.seo.ogImage ?? branding.bannerUrl ?? branding.logoUrl,
    canonical: `${input.baseUrl}/c/${input.orgSlug}${path}`,
    noindex: page.seo.noindex ?? false,
  };
}

export function buildSitemapXml(input: {
  baseUrl: string;
  orgSlug: string;
  pages: { slug: string; updatedAt?: Date }[];
}): string {
  const urls = input.pages
    .map((p) => {
      const path = p.slug === "home" ? "" : `/${p.slug}`;
      const loc = `${input.baseUrl}/c/${input.orgSlug}${path}`;
      const lastmod = p.updatedAt ? `<lastmod>${p.updatedAt.toISOString()}</lastmod>` : "";
      return `  <url><loc>${loc}</loc>${lastmod}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

export function buildRobotsTxt(input: {
  baseUrl: string;
  orgSlug: string;
  allow: boolean;
}): string {
  if (!input.allow) return "User-agent: *\nDisallow: /\n";
  return `User-agent: *\nAllow: /\nSitemap: ${input.baseUrl}/c/${input.orgSlug}/sitemap.xml\n`;
}
