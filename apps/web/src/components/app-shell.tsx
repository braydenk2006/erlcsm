"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  Building2,
  FileText,
  FormInput,
  Gauge,
  Globe,
  Home,
  Link2,
  Menu,
  Plus,
  Radio,
  Settings,
  Shield,
  Users,
  Workflow,
  X,
  CalendarRange,
  CalendarClock,
  Briefcase,
  Megaphone,
  Sparkles,
  Bot,
  Library,
  FolderKanban,
  LifeBuoy,
} from "lucide-react";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Button, cn } from "@commandry/ui";
import { BrandLockup } from "@/components/brand-mark";
import { CommandPalette } from "@/components/command-center/command-palette";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { NotificationBell } from "@/components/org/notification-bell";
import type { WorkspaceNav } from "@/lib/nav-registry";

const ICONS: Record<string, LucideIcon> = {
  Home,
  Radio,
  Gauge,
  Users,
  Briefcase,
  Building2,
  Shield,
  CalendarRange,
  Activity,
  FormInput,
  BookOpen,
  FileText,
  Workflow,
  Globe,
  Link2,
  Settings,
  Megaphone,
  CalendarClock,
  Sparkles,
  Bot,
  Library,
  FolderKanban,
  LifeBuoy,
};

type OrgSummary = {
  id: string;
  publicId: string;
  name: string;
  slug: string;
};

export function AppShell({
  user,
  organizations,
  activeOrganization,
  workspaces,
  canAssistant,
  children,
}: {
  user: { id: string; name: string; email: string };
  organizations: Array<{ id: string; publicId: string; name: string; slug: string }>;
  activeOrganization: OrgSummary | null;
  workspaces: WorkspaceNav[];
  canAssistant: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const childMatches = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);
  // The active workspace owns the deepest-matching child route.
  const activeWorkspace =
    workspaces.find((ws) =>
      ws.children.some((c) => c.href !== "/app" && pathname.startsWith(c.href)),
    ) ??
    workspaces.find((ws) => ws.children.some((c) => childMatches(c.href))) ??
    workspaces[0];
  const activeChild = activeWorkspace?.children.find((c) => childMatches(c.href));
  const breadcrumbs = [
    ...(activeWorkspace ? [{ label: activeWorkspace.label, href: activeWorkspace.href }] : []),
    ...(activeChild && activeChild.href !== activeWorkspace?.href
      ? [{ label: activeChild.label, href: activeChild.href }]
      : []),
  ];

  return (
    <div className="min-h-screen md:grid md:grid-cols-[272px_1fr] md:gap-4 md:p-4">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-[var(--cmd-border)] bg-[rgba(10,16,32,0.92)] p-4 backdrop-blur-2xl md:static md:translate-x-0 md:rounded-[var(--cmd-radius-xl)] md:border",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="mb-5 flex items-center justify-between gap-2">
          <BrandLockup size={34} subtitle="Operations workspace" />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <OrganizationSwitcher
          organizations={organizations}
          activeOrganizationId={activeOrganization?.id ?? null}
        />

        <Button asChild className="mt-4 w-full" size="sm">
          <Link href="/app/onboarding">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Quick create
          </Link>
        </Button>

        <nav aria-label="Primary" className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto pb-8">
          {workspaces.map((ws) => {
            const Icon = ICONS[ws.iconName] ?? Home;
            const isActive = ws.key === activeWorkspace?.key;
            return (
              <div key={ws.key}>
                <Link
                  href={ws.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-[var(--cmd-radius-pill)] px-3.5 py-2.5 text-sm transition",
                    isActive
                      ? "cmd-nav-active"
                      : "text-[var(--cmd-fg-muted)] hover:bg-[var(--cmd-bg-muted)] hover:text-[var(--cmd-fg)]",
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{ws.label}</span>
                </Link>
                {/* Secondary navigation for the active workspace. */}
                {isActive && ws.children.length > 1 ? (
                  <div className="ml-4 mt-1 space-y-0.5 border-l border-[var(--cmd-border)] pl-3">
                    {ws.children.map((item) => {
                      const active = childMatches(item.href) && item.key === activeChild?.key;
                      return (
                        <Link
                          key={item.key}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "block rounded-[var(--cmd-radius)] px-3 py-1.5 text-sm transition",
                            active
                              ? "text-[var(--cmd-fg)]"
                              : "text-[var(--cmd-fg-muted)] hover:text-[var(--cmd-fg)]",
                          )}
                          onClick={() => setMobileOpen(false)}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-col md:min-h-[calc(100vh-2rem)] md:overflow-hidden md:rounded-[var(--cmd-radius-xl)] md:border md:border-[var(--cmd-border)] md:bg-[rgba(12,18,34,0.45)] md:backdrop-blur-xl">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--cmd-border)] bg-[rgba(8,12,24,0.55)] px-4 py-3.5 backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <CommandPalette />
          </div>
          <div className="flex items-center gap-3 text-sm">
            {canAssistant ? (
              <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/app/assistant" aria-label="Ask Ordinex">
                  <Bot className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden md:inline">Ask Ordinex</span>
                </Link>
              </Button>
            ) : null}
            <NotificationBell />
            <div className="hidden text-right sm:block">
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-[var(--cmd-fg-muted)]">{user.email}</p>
            </div>
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] text-sm font-semibold"
              aria-hidden="true"
            >
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 pb-28 md:px-8 md:pb-8">
          {breadcrumbs.length > 0 ? (
            <nav
              aria-label="Breadcrumb"
              className="mb-4 flex items-center gap-1.5 text-xs text-[var(--cmd-fg-muted)]"
            >
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.href} className="flex items-center gap-1.5">
                  {i > 0 ? <span aria-hidden="true">/</span> : null}
                  <Link href={crumb.href} className="hover:text-[var(--cmd-fg)]">
                    {crumb.label}
                  </Link>
                </span>
              ))}
            </nav>
          ) : null}
          {children}
        </main>
      </div>

      <nav
        aria-label="Mobile"
        className="cmd-glass-strong fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-[var(--cmd-radius-pill)] px-2 py-2 md:hidden"
      >
        {workspaces.slice(0, 4).map((ws) => {
          const Icon = ICONS[ws.iconName] ?? Home;
          const active = ws.key === activeWorkspace?.key;
          return (
            <Link
              key={ws.key}
              href={ws.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-[var(--cmd-radius-pill)] px-1 py-2 text-[11px]",
                active ? "text-[var(--cmd-accent)]" : "text-[var(--cmd-fg-muted)]",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  active ? "bg-[rgba(255,59,92,0.18)]" : "bg-transparent",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>{ws.label.split(" ")[0]}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center gap-1 rounded-[var(--cmd-radius-pill)] px-1 py-2 text-[11px] text-[var(--cmd-fg-muted)]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full">
            <Menu className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
