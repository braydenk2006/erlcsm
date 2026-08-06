import { recordAuditEvent } from "@commandry/audit";
import { prisma } from "@commandry/database";
import { getErlcClientForOrganization } from "@commandry/integrations";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import { ForbiddenError, NotFoundError, ValidationError, createPublicId } from "@commandry/shared";
import {
  DEFAULT_NAV,
  DEFAULT_PUBLIC_TOGGLES,
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
  slugifyPath,
  type Block,
  type Branding,
  type NavItem,
  type PublicToggles,
  type SeoMeta,
  type Theme,
  type Visibility,
  type WebsiteSettingsDef,
} from "@commandry/website";

function requirePerm(actor: Actor, organizationId: string, action: Action): void {
  if (!authorize({ actor, organizationId, action }).allowed)
    throw new ForbiddenError("Not permitted");
}

// ---------------------------------------------------------------------------
// Settings + default site
// ---------------------------------------------------------------------------

export async function ensureDefaultSite(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  const name = org?.name ?? "Community";
  // Upsert is idempotent under concurrent first-load requests (settings + pages).
  await prisma.websiteSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      branding: defaultBranding(name) as object,
      theme: DEFAULT_THEME as object,
      nav: DEFAULT_NAV as unknown as object,
      seo: {},
      publicToggles: DEFAULT_PUBLIC_TOGGLES as object,
      published: false,
    },
    update: {},
  });
  const pageCount = await prisma.websitePage.count({ where: { organizationId } });
  if (pageCount === 0) {
    for (const page of defaultPages(name)) {
      // Tolerate races on the (organizationId, slug) unique constraint.
      await prisma.websitePage
        .create({
          data: {
            publicId: createPublicId("wpg"),
            organizationId,
            slug: page.slug,
            title: page.title,
            status: page.status,
            visibility: page.visibility,
            blocks: page.blocks as unknown as object,
            seo: page.seo as object,
            system: page.system ?? false,
          },
        })
        .catch(() => undefined);
    }
  }
}

export type WebsiteSettingsView = WebsiteSettingsDef;

export async function getWebsiteSettings(input: {
  actor: Actor;
  organizationId: string;
}): Promise<WebsiteSettingsView> {
  requirePerm(input.actor, input.organizationId, "organization:read");
  await ensureDefaultSite(input.organizationId);
  const s = await prisma.websiteSettings.findUniqueOrThrow({
    where: { organizationId: input.organizationId },
  });
  return {
    branding: s.branding as Branding,
    theme: s.theme as Theme,
    nav: s.nav as NavItem[],
    seo: s.seo as SeoMeta,
    publicToggles: s.publicToggles as PublicToggles,
    published: s.published,
  };
}

export async function updateWebsiteSettings(input: {
  actor: Actor;
  organizationId: string;
  branding?: Partial<Branding>;
  theme?: Theme;
  nav?: NavItem[];
  seo?: SeoMeta;
  publicToggles?: PublicToggles;
  published?: boolean;
}): Promise<void> {
  requirePerm(input.actor, input.organizationId, "organization:update");
  await ensureDefaultSite(input.organizationId);
  const current = await prisma.websiteSettings.findUniqueOrThrow({
    where: { organizationId: input.organizationId },
  });
  await prisma.websiteSettings.update({
    where: { organizationId: input.organizationId },
    data: {
      ...(input.branding
        ? { branding: { ...(current.branding as object), ...input.branding } as object }
        : {}),
      ...(input.theme ? { theme: input.theme as object } : {}),
      ...(input.nav ? { nav: input.nav as unknown as object } : {}),
      ...(input.seo ? { seo: input.seo as object } : {}),
      ...(input.publicToggles ? { publicToggles: input.publicToggles as object } : {}),
      ...(input.published !== undefined ? { published: input.published } : {}),
    },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "organization:update",
    resourceType: "website_settings",
    resourceId: input.organizationId,
    source: "WEB",
    metadata: { published: input.published },
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Pages (admin)
// ---------------------------------------------------------------------------

export type PageView = {
  id: string;
  slug: string;
  title: string;
  status: string;
  visibility: string;
  system: boolean;
  blocks: Block[];
  seo: SeoMeta;
};

function toPageView(p: {
  id: string;
  slug: string;
  title: string;
  status: string;
  visibility: string;
  system: boolean;
  blocks: unknown;
  seo: unknown;
}): PageView {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    status: p.status,
    visibility: p.visibility,
    system: p.system,
    blocks: (p.blocks as Block[]) ?? [],
    seo: (p.seo as SeoMeta) ?? {},
  };
}

export async function listPages(input: {
  actor: Actor;
  organizationId: string;
}): Promise<PageView[]> {
  requirePerm(input.actor, input.organizationId, "organization:read");
  await ensureDefaultSite(input.organizationId);
  const pages = await prisma.websitePage.findMany({
    where: { organizationId: input.organizationId },
    orderBy: { createdAt: "asc" },
  });
  return pages.map(toPageView);
}

export async function getPage(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<PageView> {
  requirePerm(input.actor, input.organizationId, "organization:read");
  const p = await prisma.websitePage.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!p) throw new NotFoundError("Page not found");
  return toPageView(p);
}

export async function createPage(input: {
  actor: Actor;
  organizationId: string;
  title: string;
  slug?: string;
}): Promise<PageView> {
  requirePerm(input.actor, input.organizationId, "organization:update");
  const slug = slugifyPath(input.slug ?? input.title) || `page-${Date.now().toString(36)}`;
  const existing = await prisma.websitePage.findFirst({
    where: { organizationId: input.organizationId, slug },
  });
  if (existing) throw new ValidationError("A page with that slug already exists");
  const page = await prisma.websitePage.create({
    data: {
      publicId: createPublicId("wpg"),
      organizationId: input.organizationId,
      slug,
      title: input.title.trim(),
      status: "DRAFT",
      visibility: "PUBLIC",
      blocks: [] as unknown as object,
      seo: {},
      createdByUserId: input.actor.userId,
    },
  });
  return toPageView(page);
}

export async function updatePage(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  title?: string;
  status?: string;
  visibility?: Visibility;
  blocks?: Block[];
  seo?: SeoMeta;
}): Promise<void> {
  requirePerm(input.actor, input.organizationId, "organization:update");
  const page = await prisma.websitePage.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!page) throw new NotFoundError("Page not found");
  const cleanBlocks = input.blocks
    ? input.blocks.map((b) => normalizeBlock(b)).filter((b): b is Block => b !== null)
    : undefined;
  await prisma.websitePage.update({
    where: { id: page.id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      ...(cleanBlocks ? { blocks: cleanBlocks as unknown as object } : {}),
      ...(input.seo !== undefined ? { seo: input.seo as object } : {}),
      version: { increment: 1 },
    },
  });
}

export async function deletePage(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<void> {
  requirePerm(input.actor, input.organizationId, "organization:update");
  const page = await prisma.websitePage.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!page) throw new NotFoundError("Page not found");
  if (page.system) throw new ValidationError("System pages cannot be deleted");
  await prisma.websitePage.delete({ where: { id: page.id } });
}

// ---------------------------------------------------------------------------
// Public resolver — consumes live Ordinex data (no duplication)
// ---------------------------------------------------------------------------

export type PublicSite = {
  orgSlug: string;
  branding: Branding;
  themeVars: Record<string, string>;
  themeMode: string;
  nav: { label: string; slug: string }[];
};

async function resolveOrgBySlug(orgSlug: string) {
  return prisma.organization.findFirst({
    where: { slug: orgSlug, deletedAt: null },
    select: { id: true, name: true, slug: true },
  });
}

export async function getPublicSite(orgSlug: string): Promise<PublicSite | null> {
  const org = await resolveOrgBySlug(orgSlug);
  if (!org) return null;
  const settings = await prisma.websiteSettings.findUnique({ where: { organizationId: org.id } });
  if (!settings || !settings.published) return null;
  const branding = settings.branding as Branding;
  const theme = settings.theme as Theme;
  const nav = settings.nav as NavItem[];
  const pages = await prisma.websitePage.findMany({
    where: { organizationId: org.id, status: "PUBLISHED", visibility: "PUBLIC" },
    select: { slug: true },
  });
  const publishedSlugs = new Set(pages.map((p) => p.slug));
  return {
    orgSlug: org.slug,
    branding,
    themeVars: buildThemeVars(theme, branding),
    themeMode: theme.mode,
    nav: nav
      .filter((n) => (n.pageSlug ? publishedSlugs.has(n.pageSlug) : Boolean(n.href)))
      .map((n) => ({ label: n.label, slug: n.pageSlug ?? n.href ?? "home" })),
  };
}

export type ResolvedBlock = {
  id: string;
  type: string;
  config: Record<string, unknown>;
  data: unknown;
};
export type PublicPage = {
  title: string;
  slug: string;
  meta: ReturnType<typeof buildPageMeta>;
  blocks: ResolvedBlock[];
};

async function resolveDynamicBlock(
  organizationId: string,
  block: Block,
  toggles: PublicToggles,
): Promise<unknown> {
  const limit = typeof block.config.limit === "number" ? block.config.limit : 10;
  switch (block.type) {
    case "announcements":
    case "latest_news": {
      const rows = await prisma.announcement.findMany({
        where: {
          organizationId,
          status: "PUBLISHED",
          departmentId: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: { author: { select: { name: true } } },
        orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
        take: Math.min(limit, 20),
      });
      return rows.map((a) => ({
        title: a.title,
        body: a.body,
        author: a.author.name,
        publishedAt: a.publishedAt,
        pinned: a.pinned,
      }));
    }
    case "staff_directory": {
      const members = await prisma.membership.findMany({
        where: { organizationId, status: "ACTIVE" },
        include: {
          user: {
            select: { name: true, robloxLink: { select: { avatarUrl: true, username: true } } },
          },
          roles: { include: { role: { select: { key: true, name: true } } } },
          departmentMembers: { include: { department: { select: { name: true } } } },
        },
        take: Math.min(limit, 50),
      });
      // Public-safe fields only: name, title, roles, departments, avatar. No email/discord.
      return members.map((m) => ({
        name: m.user.name,
        title: m.title,
        roles: m.roles.map((r) => r.role.name),
        departments: m.departmentMembers.map((d) => d.department.name),
        avatarUrl: m.user.robloxLink?.avatarUrl ?? null,
        robloxUsername: m.user.robloxLink?.username ?? null,
      }));
    }
    case "department_list":
    case "department_spotlight": {
      const depts = await prisma.department.findMany({
        where: { organizationId, deletedAt: null, isActive: true },
        include: { _count: { select: { members: true } } },
        orderBy: { name: "asc" },
        take: block.type === "department_spotlight" ? 1 : 20,
      });
      return depts.map((d) => ({
        name: d.name,
        description: d.description,
        accentColor: d.accentColor,
        memberCount: d._count.members,
      }));
    }
    case "upcoming_patrols":
    case "calendar": {
      const shifts = await prisma.scheduledShift.findMany({
        where: {
          organizationId,
          status: { in: ["OPEN_CLAIMING", "CLAIMED", "SCHEDULED", "PUBLISHED"] },
          scheduledStart: { gte: new Date() },
        },
        orderBy: { scheduledStart: "asc" },
        take: Math.min(limit, 20),
      });
      return shifts.map((s) => ({ title: s.title, start: s.scheduledStart, type: s.shiftType }));
    }
    case "upcoming_sessions": {
      const sessions = await prisma.operationalSession.findMany({
        where: { organizationId, status: { in: ["SCHEDULED", "OPEN", "ACTIVE"] } },
        orderBy: [{ scheduledFor: "asc" }],
        take: Math.min(limit, 20),
      });
      return sessions.map((s) => ({ title: s.title, scheduledFor: s.scheduledFor, type: s.type }));
    }
    case "application_list": {
      const templates = await prisma.workflowTemplate.findMany({
        where: { organizationId, active: true, category: "application" },
        select: { name: true, description: true },
      });
      return templates.map((t) => ({ name: t.name, description: t.description }));
    }
    case "server_status":
    case "player_count": {
      if (!toggles.serverStatus && block.type === "server_status") return { enabled: false };
      if (!toggles.playerCount && block.type === "player_count") return { enabled: false };
      try {
        const { client, mode } = await getErlcClientForOrganization(organizationId);
        const status = await client.getServerStatus();
        return {
          enabled: true,
          online: status.connected,
          name: status.name,
          currentPlayers: status.currentPlayers,
          maxPlayers: status.maxPlayers,
          mode,
        };
      } catch {
        return { enabled: true, online: false };
      }
    }
    default:
      return null;
  }
}

async function resolveStats(
  organizationId: string,
  toggles: PublicToggles,
): Promise<{ label: string; value: string }[]> {
  const out: { label: string; value: string }[] = [];
  const enabled = new Set(toggles.stats);
  if (enabled.has("members") && toggles.memberCount) {
    out.push({
      label: "Members",
      value: String(await prisma.membership.count({ where: { organizationId, status: "ACTIVE" } })),
    });
  }
  if (enabled.has("departments")) {
    out.push({
      label: "Departments",
      value: String(await prisma.department.count({ where: { organizationId, deletedAt: null } })),
    });
  }
  if (enabled.has("completed_patrols")) {
    out.push({
      label: "Completed patrols",
      value: String(
        await prisma.scheduledShift.count({ where: { organizationId, status: "COMPLETED" } }),
      ),
    });
  }
  if (enabled.has("completed_trainings")) {
    out.push({
      label: "Trainings completed",
      value: String(
        await prisma.workflowSubmission.count({
          where: { organizationId, status: "COMPLETED", template: { category: "training" } },
        }),
      ),
    });
  }
  if (enabled.has("upcoming_events")) {
    out.push({
      label: "Upcoming events",
      value: String(
        await prisma.scheduledShift.count({
          where: {
            organizationId,
            scheduledStart: { gte: new Date() },
            status: { notIn: ["CANCELLED", "COMPLETED", "MISSED"] },
          },
        }),
      ),
    });
  }
  return out;
}

export async function getPublicPage(input: {
  orgSlug: string;
  pageSlug: string;
  baseUrl: string;
}): Promise<PublicPage | null> {
  const org = await resolveOrgBySlug(input.orgSlug);
  if (!org) return null;
  const settings = await prisma.websiteSettings.findUnique({ where: { organizationId: org.id } });
  if (!settings || !settings.published) return null;
  const page = await prisma.websitePage.findFirst({
    where: {
      organizationId: org.id,
      slug: input.pageSlug,
      status: "PUBLISHED",
      visibility: "PUBLIC",
    },
  });
  if (!page) return null;

  const branding = settings.branding as Branding;
  const toggles = settings.publicToggles as PublicToggles;
  const blocks = ((page.blocks as Block[]) ?? []).filter(isPublicBlock);

  const resolved: ResolvedBlock[] = [];
  for (const block of blocks) {
    let data: unknown = null;
    if (block.type === "stats") data = await resolveStats(org.id, toggles);
    else if (isDynamicBlock(block.type)) data = await resolveDynamicBlock(org.id, block, toggles);
    resolved.push({ id: block.id, type: block.type, config: block.config, data });
  }

  return {
    title: page.title,
    slug: page.slug,
    meta: buildPageMeta({
      branding,
      siteSeo: settings.seo as SeoMeta,
      page: { title: page.title, slug: page.slug, seo: page.seo as SeoMeta },
      baseUrl: input.baseUrl,
      orgSlug: org.slug,
    }),
    blocks: resolved,
  };
}

export async function recordWebsiteVisit(orgSlug: string, path: string): Promise<void> {
  const org = await resolveOrgBySlug(orgSlug);
  if (!org) return;
  const day = new Date().toISOString().slice(0, 10);
  await prisma.websiteVisit
    .upsert({
      where: { organizationId_path_day: { organizationId: org.id, path, day } },
      create: { organizationId: org.id, path, day, count: 1 },
      update: { count: { increment: 1 } },
    })
    .catch(() => undefined);
}

export async function getPublicSitemap(orgSlug: string, baseUrl: string): Promise<string | null> {
  const org = await resolveOrgBySlug(orgSlug);
  if (!org) return null;
  const settings = await prisma.websiteSettings.findUnique({ where: { organizationId: org.id } });
  if (!settings?.published) return null;
  const pages = await prisma.websitePage.findMany({
    where: { organizationId: org.id, status: "PUBLISHED", visibility: "PUBLIC" },
    select: { slug: true, updatedAt: true },
  });
  return buildSitemapXml({ baseUrl, orgSlug: org.slug, pages });
}

export async function getPublicRobots(orgSlug: string, baseUrl: string): Promise<string> {
  const org = await resolveOrgBySlug(orgSlug);
  const settings = org
    ? await prisma.websiteSettings.findUnique({ where: { organizationId: org.id } })
    : null;
  return buildRobotsTxt({ baseUrl, orgSlug, allow: Boolean(settings?.published) });
}

export type WebsiteAnalytics = { totalViews: number; topPages: { path: string; views: number }[] };

export async function getWebsiteAnalytics(input: {
  actor: Actor;
  organizationId: string;
}): Promise<WebsiteAnalytics> {
  requirePerm(input.actor, input.organizationId, "organization:read");
  const rows = await prisma.websiteVisit.groupBy({
    by: ["path"],
    where: { organizationId: input.organizationId },
    _sum: { count: true },
  });
  const topPages = rows
    .map((r) => ({ path: r.path, views: r._sum.count ?? 0 }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
  return { totalViews: topPages.reduce((acc, p) => acc + p.views, 0), topPages };
}
