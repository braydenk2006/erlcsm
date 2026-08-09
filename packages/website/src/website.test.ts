import { describe, expect, it } from "vitest";
import {
  BLOCK_SOURCE,
  DEFAULT_THEME,
  buildPageMeta,
  buildRobotsTxt,
  buildSitemapXml,
  buildThemeVars,
  defaultBranding,
  defaultPages,
  isDynamicBlock,
  isPublicBlock,
  normalizeBlock,
} from "./index";

describe("blocks", () => {
  it("identifies dynamic blocks and their Ordinex source", () => {
    expect(isDynamicBlock("staff_directory")).toBe(true);
    expect(isDynamicBlock("hero")).toBe(false);
    expect(BLOCK_SOURCE.announcements).toBe("announcements");
    expect(BLOCK_SOURCE.upcoming_patrols).toBe("operational_time");
    expect(BLOCK_SOURCE.application_list).toBe("workflow");
  });
  it("normalizes/rejects blocks and defaults visibility to PUBLIC", () => {
    expect(normalizeBlock({ type: "nope" })).toBeNull();
    const b = normalizeBlock({ type: "hero", config: { heading: "Hi" } })!;
    expect(b.visibility).toBe("PUBLIC");
    expect(isPublicBlock(b)).toBe(true);
    expect(isPublicBlock({ ...b, visibility: "MEMBERS" })).toBe(false);
  });
});

describe("theme + branding", () => {
  it("builds CSS vars honoring branding overrides", () => {
    const branding = defaultBranding("Test PD", "#123456");
    const vars = buildThemeVars(DEFAULT_THEME, branding);
    expect(vars["--site-accent"]).toBe("#123456");
    expect(vars["--site-bg"]).toBe(DEFAULT_THEME.colors.background);
    expect(vars["--site-radius"]).toBe("16px");
  });
});

describe("default site", () => {
  it("ships a home page synced to Ordinex modules + system pages", () => {
    const pages = defaultPages("Test PD");
    const home = pages.find((p) => p.slug === "home")!;
    expect(home.status).toBe("PUBLISHED");
    const types = home.blocks.map((b) => b.type);
    expect(types).toEqual(
      expect.arrayContaining([
        "hero",
        "announcements",
        "upcoming_patrols",
        "staff_directory",
        "department_list",
      ]),
    );
    expect(pages.map((p) => p.slug)).toEqual(
      expect.arrayContaining([
        "staff",
        "departments",
        "applications",
        "calendar",
        "news",
        "contact",
      ]),
    );
  });
});

describe("SEO", () => {
  const branding = defaultBranding("Test PD");
  it("builds page metadata with fallbacks + canonical", () => {
    const meta = buildPageMeta({
      branding,
      siteSeo: {},
      page: { title: "Staff", slug: "staff", seo: {} },
      baseUrl: "https://x.dev",
      orgSlug: "test-pd",
    });
    expect(meta.title).toBe("Staff · Test PD");
    expect(meta.canonical).toBe("https://x.dev/c/test-pd/staff");
  });
  it("builds a sitemap + robots", () => {
    const sitemap = buildSitemapXml({
      baseUrl: "https://x.dev",
      orgSlug: "test-pd",
      pages: [{ slug: "home" }, { slug: "staff" }],
    });
    expect(sitemap).toContain("https://x.dev/c/test-pd</loc>");
    expect(sitemap).toContain("https://x.dev/c/test-pd/staff</loc>");
    expect(
      buildRobotsTxt({ baseUrl: "https://x.dev", orgSlug: "test-pd", allow: false }),
    ).toContain("Disallow: /");
    expect(buildRobotsTxt({ baseUrl: "https://x.dev", orgSlug: "test-pd", allow: true })).toContain(
      "Sitemap:",
    );
  });
});
