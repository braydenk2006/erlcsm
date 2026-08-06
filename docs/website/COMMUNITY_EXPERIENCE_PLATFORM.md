# Community Experience Platform (Phase 6)

A first-class public website subsystem that **consumes existing Ordinex data** instead of duplicating
it. Every organization gets a professional, dynamically-synchronized public site in minutes — no Wix,
Carrd, Squarespace, Notion, or third-party portal.

## 1. Architecture

```
Community Experience Platform
├── Website Builder        (pages + block layout, /app/website)
├── Theme Engine           (theme -> CSS variables)
├── Block Engine           (reusable static + dynamic blocks)
├── Dynamic Content Engine (resolves blocks from live Ordinex modules)
├── Navigation Engine      (nav from published public pages)
├── Branding System        (propagates site-wide via CSS vars)
├── SEO System             (page meta, canonical, sitemap, robots, OG)
├── Public Content Perms   (published + PUBLIC only; public-safe fields)
├── Media Library          (MediaAsset)
├── Public Analytics       (privacy-preserving page-view counts)
└── Routing System         (/c/[org] and /c/[org]/[page])
```

- Pure domain: `@commandry/website` — block registry (static + dynamic), theme + branding schema,
  `buildThemeVars`, page/nav/visibility types, the default site, and SEO helpers
  (`buildPageMeta`/`buildSitemapXml`/`buildRobotsTxt`). Unit-tested.
- Service: `@commandry/api/website` — admin (settings, pages, media) + the **public resolver**.

## 2. Block Engine

A page is an ordered list of `Block { id, type, config, visibility, roleKeys? }`. Static blocks
(hero, text, cta, stats, faq, gallery, divider, spacer, contact_form, …) render from config; **dynamic
blocks** resolve live data at render time. `normalizeBlock` validates/sanitizes; `isPublicBlock`
gates visibility. New block types are one registry entry + a renderer branch.

## 3. Dynamic Content Engine (consume, never duplicate)

| Block                                      | Ordinex source                                                        |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `announcements` / `latest_news`            | Announcement system (published, org-wide, non-expired)                |
| `staff_directory`                          | Members (active) — public-safe fields only                            |
| `department_list` / `department_spotlight` | Department module                                                     |
| `upcoming_patrols` / `calendar`            | Operational Time Platform (scheduled shifts)                          |
| `upcoming_sessions`                        | Operational Time Platform (sessions)                                  |
| `application_list`                         | Workflow Platform (application templates)                             |
| `server_status` / `player_count`           | Server Management (ER:LC/PRC), gated by public toggles                |
| `stats`                                    | live counts (members/departments/completed patrols/upcoming events/…) |

Organizations never re-enter data that already lives in Ordinex; publishing an announcement or
scheduling a shift updates the website automatically.

## 4. Theme Engine

`Theme { mode: light|dark|auto, colors, radius, fontHeading, fontBody }` → `buildThemeVars` emits
`--site-*` CSS variables consumed by every block, so themes/branding are swappable without rebuilding
pages. Built-in themes ship (Midnight, Daybreak). **Marketplace-ready**: themes are self-contained
objects — future install/switch/duplicate/export require no redesign.

## 5. Public Routing

- `GET /c/[org]` — the home page.
- `GET /c/[org]/[page]` — any published public page.
- `GET /c/[org]/sitemap.xml`, `GET /c/[org]/robots.txt`.

Public routes are unauthenticated, resolve the org by slug, and serve **only** when the site is
`published`. Custom domains / white-label are Enterprise follow-ups (the resolver already keys off a
slug, so a domain → slug mapping slots in without changes).

## 6. SEO

`buildPageMeta` produces title/description/OG/canonical with branding fallbacks (overridable per
page); `generateMetadata` wires these into Next. `sitemap.xml` lists published public pages;
`robots.txt` disallows crawling until the site is published.

## 7. Branding

`Branding { name, description, logo/banner/favicon, primary/secondary/accent, discordInvite,
robloxGroup, socials }` stored in `WebsiteSettings` and propagated everywhere via CSS vars + the
shell header/footer.

## 8. Permissions

Every page and block carries `visibility` (`PUBLIC`/`MEMBERS`/`AUTHENTICATED`/`ROLES`). The public
resolver returns only `PUBLISHED` + `PUBLIC` pages and filters non-public blocks. Staff data exposes
**public-safe fields only** (name, title, roles, departments, avatar) — never email/Discord unless
explicitly enabled. Server status / player count are off unless the org opts in (`publicToggles`).

## 9. Analytics

`WebsiteVisit` is an aggregate (org, path, day, count) — no per-visitor rows or PII. Admin analytics
show total views + top pages.

## 10. Database schema

`WebsiteSettings` (branding/theme/nav/seo/publicToggles/published), `WebsitePage` (slug/title/status/
visibility/blocks/seo/version/system), `MediaAsset` (library), `WebsiteVisit` (analytics). All
tenant-scoped.

## 11. Extension points

- **New blocks**: add to `BLOCK_TYPES` (+ `BLOCK_SOURCE` for dynamic) + a resolver branch + a
  renderer branch.
- **Marketplaces / themes / plugins / custom widgets**: themes are portable objects; blocks are a
  registry; the resolver dispatches by type — new packs register without touching the engine.
- **Custom domains / white-label / blog / docs / KB / stores**: the resolver keys off a slug and the
  page/block model is generic, so these are additive.

## Test tiers

Unit-tested (blocks, theme vars, default site, SEO) and integration-tested (public resolver dynamic
sync from announcements/departments/staff/stats, public-safe fields, only-published pages, SEO/
canonical). Drag-and-drop reordering (currently up/down), media upload storage backend, full
per-visitor analytics, custom domains, and the marketplace are documented follow-ups — the
architecture supports them without redesign.
