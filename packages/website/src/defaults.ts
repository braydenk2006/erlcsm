import type { Block, Branding, NavItem, Theme, WebsitePageDef } from "./index";

export const DEFAULT_THEME: Theme = {
  key: "midnight",
  name: "Midnight",
  mode: "dark",
  colors: {
    primary: "#3B6CFF",
    secondary: "#8B5CF6",
    accent: "#FF3B5C",
    background: "#05060A",
    surface: "#0E1018",
    foreground: "#E8ECF6",
    muted: "#9AA4BF",
    border: "#20232E",
  },
  radius: 16,
  fontHeading: "system-ui, sans-serif",
  fontBody: "system-ui, sans-serif",
};

export const LIGHT_THEME: Theme = {
  key: "daybreak",
  name: "Daybreak",
  mode: "light",
  colors: {
    primary: "#2853E6",
    secondary: "#7C3AED",
    accent: "#E11D48",
    background: "#F7F8FC",
    surface: "#FFFFFF",
    foreground: "#0E1018",
    muted: "#5B6478",
    border: "#E3E6EF",
  },
  radius: 16,
  fontHeading: "system-ui, sans-serif",
  fontBody: "system-ui, sans-serif",
};

export const BUILT_IN_THEMES: Theme[] = [DEFAULT_THEME, LIGHT_THEME];

export function defaultBranding(name: string, accent = "#FF3B5C"): Branding {
  return {
    name,
    description: `${name} — a community running on Ordinex.`,
    primaryColor: "#3B6CFF",
    secondaryColor: "#8B5CF6",
    accentColor: accent,
    socials: [],
  };
}

const blk = (type: Block["type"], config: Record<string, unknown> = {}): Block => ({
  id: `blk_${type}_${Math.random().toString(36).slice(2, 8)}`,
  type,
  config,
  visibility: "PUBLIC",
});

/** The default site every organization receives — already synced to Ordinex. */
export function defaultPages(name: string): WebsitePageDef[] {
  const pub = { status: "PUBLISHED" as const, visibility: "PUBLIC" as const };
  return [
    {
      slug: "home",
      title: "Home",
      ...pub,
      system: true,
      seo: { title: name, description: `Welcome to ${name}.` },
      blocks: [
        blk("hero", {
          heading: name,
          subheading: "Operations, dispatch, and community — all in one place.",
          ctaLabel: "Apply now",
          ctaHref: "/applications",
        }),
        blk("stats", {}),
        blk("announcements", { title: "Latest news", limit: 3 }),
        blk("upcoming_patrols", { title: "Upcoming shifts", limit: 5 }),
        blk("staff_directory", { title: "Meet the team", limit: 8 }),
        blk("department_list", { title: "Departments" }),
        blk("cta", {
          heading: "Ready to join?",
          ctaLabel: "View applications",
          ctaHref: "/applications",
        }),
      ],
    },
    {
      slug: "about",
      title: "About",
      ...pub,
      seo: { title: `About ${name}` },
      blocks: [
        blk("text", {
          heading: "About us",
          body: `${name} is a roleplay community powered by Ordinex.`,
        }),
        blk("stats", {}),
      ],
    },
    {
      slug: "staff",
      title: "Staff",
      ...pub,
      seo: { title: `${name} Staff` },
      blocks: [blk("staff_directory", { title: "Our staff" })],
    },
    {
      slug: "departments",
      title: "Departments",
      ...pub,
      seo: {},
      blocks: [blk("department_list", { title: "Departments" })],
    },
    {
      slug: "applications",
      title: "Applications",
      ...pub,
      seo: { title: `Apply to ${name}` },
      blocks: [blk("application_list", { title: "Open applications" })],
    },
    {
      slug: "calendar",
      title: "Calendar",
      ...pub,
      seo: {},
      blocks: [
        blk("calendar", { title: "Community calendar" }),
        blk("upcoming_sessions", { title: "Upcoming sessions" }),
      ],
    },
    {
      slug: "news",
      title: "News",
      ...pub,
      seo: {},
      blocks: [blk("latest_news", { title: "News", limit: 20 })],
    },
    {
      slug: "contact",
      title: "Contact",
      ...pub,
      seo: {},
      blocks: [blk("contact_form", { title: "Contact us" })],
    },
  ];
}

export const DEFAULT_NAV: NavItem[] = [
  { label: "Home", pageSlug: "home" },
  { label: "About", pageSlug: "about" },
  { label: "Departments", pageSlug: "departments" },
  { label: "Staff", pageSlug: "staff" },
  { label: "Calendar", pageSlug: "calendar" },
  { label: "News", pageSlug: "news" },
  { label: "Applications", pageSlug: "applications" },
  { label: "Contact", pageSlug: "contact" },
];
