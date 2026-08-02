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
  Radio,
  Search,
  Settings,
  Shield,
  Users,
  Workflow,
  X,
  CalendarRange,
  Briefcase,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, cn } from "@commandry/ui";
import { BrandLockup } from "@/components/brand-mark";
import { OrganizationSwitcher } from "@/components/organization-switcher";

const NAV_ITEMS = [
  { href: "/app", label: "Home", icon: Home, module: "home" },
  { href: "/app/live", label: "Live Server", icon: Radio, module: "live_server" },
  { href: "/app/people", label: "People", icon: Users, module: "people" },
  { href: "/app/staff", label: "Staff", icon: Briefcase, module: "staff" },
  { href: "/app/departments", label: "Departments", icon: Building2, module: "departments" },
  { href: "/app/moderation", label: "Moderation", icon: Shield, module: "moderation" },
  { href: "/app/sessions", label: "Sessions", icon: CalendarRange, module: "sessions" },
  { href: "/app/activity", label: "Activity", icon: Activity, module: "activity" },
  { href: "/app/applications", label: "Applications", icon: FormInput, module: "applications" },
  { href: "/app/training", label: "Training", icon: BookOpen, module: "training" },
  { href: "/app/cad", label: "CAD", icon: Gauge, module: "cad" },
  { href: "/app/documents", label: "Documents", icon: FileText, module: "documents" },
  { href: "/app/forms", label: "Forms", icon: FormInput, module: "forms" },
  { href: "/app/automations", label: "Automations", icon: Workflow, module: "automations" },
  { href: "/app/analytics", label: "Analytics", icon: Gauge, module: "analytics" },
  { href: "/app/website", label: "Website", icon: Globe, module: "website" },
  { href: "/app/integrations", label: "Integrations", icon: Link2, module: "integrations" },
  { href: "/app/settings", label: "Settings", icon: Settings, module: "settings" },
] as const;

type OrgSummary = {
  id: string;
  publicId: string;
  name: string;
  slug: string;
  enabledModules?: string[];
};

export function AppShell({
  user,
  organizations,
  activeOrganization,
  children,
}: {
  user: { id: string; name: string; email: string };
  organizations: Array<{ id: string; publicId: string; name: string; slug: string }>;
  activeOrganization: OrgSummary | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const enabledModules = useMemo(
    () => new Set(activeOrganization?.enabledModules ?? ["home", "people", "staff", "settings"]),
    [activeOrganization],
  );

  const visibleNav = NAV_ITEMS.filter(
    (item) =>
      item.module === "home" || item.module === "settings" || enabledModules.has(item.module),
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[260px_1fr]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[270px] border-r border-[var(--cmd-border)] bg-[rgba(10,12,20,0.88)] p-4 backdrop-blur-xl md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="mb-6 flex items-center justify-between gap-2">
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

        <nav aria-label="Primary" className="mt-6 space-y-1 overflow-y-auto pb-24">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                  active
                    ? "cmd-gradient-fill shadow-[0_8px_24px_rgba(59,108,255,0.25)]"
                    : "text-[var(--cmd-fg-muted)] hover:bg-[var(--cmd-bg-muted)] hover:text-[var(--cmd-fg)]",
                )}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--cmd-border)] bg-[rgba(5,6,10,0.72)] px-4 py-3 backdrop-blur-xl md:px-6">
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
            <button
              type="button"
              className="cmd-glass hidden items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--cmd-fg-muted)] md:inline-flex"
              aria-label="Open command palette"
            >
              <Search className="h-4 w-4" />
              <span>Search or jump…</span>
              <Badge tone="accent">⌘K</Badge>
            </button>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-[var(--cmd-fg-muted)]">{user.email}</p>
            </div>
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 md:px-8">
          {children}
        </main>
      </div>

      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--cmd-border)] bg-[rgba(10,12,20,0.94)] px-2 py-2 backdrop-blur-xl md:hidden"
      >
        {visibleNav.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px]",
                active ? "text-[var(--cmd-accent)]" : "text-[var(--cmd-fg-muted)]",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
