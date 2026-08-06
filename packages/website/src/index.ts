/**
 * Community Experience Platform — domain.
 *
 * A public website that CONSUMES existing Ordinex data (announcements, members,
 * departments, shifts/sessions, applications, server status) rather than
 * duplicating it. Blocks are reusable; dynamic blocks resolve live data at
 * render time. Themes/branding propagate via CSS variables.
 */

export const BLOCK_TYPES = [
  // Layout / static
  "hero",
  "text",
  "image",
  "video",
  "buttons",
  "feature_grid",
  "stats",
  "cards",
  "faq",
  "gallery",
  "cta",
  "rich_html",
  "divider",
  "spacer",
  "discord_widget",
  "map",
  "sponsors",
  "contact_form",
  // Dynamic (resolved from Ordinex modules)
  "staff_directory",
  "department_list",
  "department_spotlight",
  "server_status",
  "player_count",
  "upcoming_sessions",
  "upcoming_patrols",
  "calendar",
  "announcements",
  "latest_news",
  "application_list",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/** Blocks whose content is pulled live from Ordinex (never manually edited). */
export const DYNAMIC_BLOCK_TYPES: ReadonlySet<BlockType> = new Set<BlockType>([
  "staff_directory",
  "department_list",
  "department_spotlight",
  "server_status",
  "player_count",
  "upcoming_sessions",
  "upcoming_patrols",
  "calendar",
  "announcements",
  "latest_news",
  "application_list",
]);

/** Which Ordinex source a dynamic block consumes (for docs + resolver dispatch). */
export const BLOCK_SOURCE: Partial<Record<BlockType, string>> = {
  staff_directory: "members",
  department_list: "departments",
  department_spotlight: "departments",
  server_status: "server",
  player_count: "server",
  upcoming_sessions: "operational_time",
  upcoming_patrols: "operational_time",
  calendar: "operational_time",
  announcements: "announcements",
  latest_news: "announcements",
  application_list: "workflow",
};

export function isBlockType(value: string): value is BlockType {
  return (BLOCK_TYPES as readonly string[]).includes(value);
}
export function isDynamicBlock(type: BlockType): boolean {
  return DYNAMIC_BLOCK_TYPES.has(type);
}

export type Visibility = "PUBLIC" | "MEMBERS" | "AUTHENTICATED" | "ROLES";
export const VISIBILITIES: Visibility[] = ["PUBLIC", "MEMBERS", "AUTHENTICATED", "ROLES"];

export type Block = {
  id: string;
  type: BlockType;
  config: Record<string, unknown>;
  visibility: Visibility;
  roleKeys?: string[];
};

export const PAGE_STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];

export type SeoMeta = {
  title?: string;
  description?: string;
  ogImage?: string;
  noindex?: boolean;
};

export type WebsitePageDef = {
  slug: string;
  title: string;
  status: PageStatus;
  visibility: Visibility;
  blocks: Block[];
  seo: SeoMeta;
  system?: boolean;
};

export type NavItem = { label: string; pageSlug?: string; href?: string; external?: boolean };

// ---------------------------------------------------------------------------
// Theme + branding
// ---------------------------------------------------------------------------

export type ThemeColors = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  border: string;
};

export type Theme = {
  key: string;
  name: string;
  mode: "light" | "dark" | "auto";
  colors: ThemeColors;
  radius: number;
  fontHeading: string;
  fontBody: string;
};

export type Branding = {
  name: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  discordInvite?: string;
  robloxGroup?: string;
  socials: { label: string; url: string }[];
};

/** Which optional public data an org has explicitly enabled (privacy by default). */
export type PublicToggles = {
  serverStatus: boolean;
  playerCount: boolean;
  memberCount: boolean;
  stats: string[]; // enabled stat keys
};

export const DEFAULT_PUBLIC_TOGGLES: PublicToggles = {
  serverStatus: true,
  playerCount: true,
  memberCount: true,
  stats: ["members", "departments", "completed_patrols", "upcoming_events"],
};

export type WebsiteSettingsDef = {
  branding: Branding;
  theme: Theme;
  nav: NavItem[];
  seo: SeoMeta;
  publicToggles: PublicToggles;
  published: boolean;
};

/** Build the CSS custom properties a theme injects into the public site root. */
export function buildThemeVars(theme: Theme, branding: Branding): Record<string, string> {
  return {
    "--site-primary": branding.primaryColor || theme.colors.primary,
    "--site-secondary": branding.secondaryColor || theme.colors.secondary,
    "--site-accent": branding.accentColor || theme.colors.accent,
    "--site-bg": theme.colors.background,
    "--site-surface": theme.colors.surface,
    "--site-fg": theme.colors.foreground,
    "--site-muted": theme.colors.muted,
    "--site-border": theme.colors.border,
    "--site-radius": `${theme.radius}px`,
    "--site-font-heading": theme.fontHeading,
    "--site-font-body": theme.fontBody,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function normalizeBlock(input: {
  id?: string;
  type: string;
  config?: Record<string, unknown>;
  visibility?: string;
  roleKeys?: string[];
}): Block | null {
  if (!isBlockType(input.type)) return null;
  const visibility = (VISIBILITIES as string[]).includes(input.visibility ?? "")
    ? (input.visibility as Visibility)
    : "PUBLIC";
  return {
    id: input.id ?? `blk_${Math.random().toString(36).slice(2, 10)}`,
    type: input.type,
    config: input.config ?? {},
    visibility,
    ...(input.roleKeys ? { roleKeys: input.roleKeys } : {}),
  };
}

/** A block is publicly visible only when its visibility is PUBLIC. */
export function isPublicBlock(block: Block): boolean {
  return block.visibility === "PUBLIC";
}

export function slugifyPath(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export * from "./defaults";
export * from "./seo";
