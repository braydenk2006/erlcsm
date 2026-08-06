/**
 * Quick Actions + Command Palette navigation registry. Every entry declares the
 * permission/entitlement it needs so the dashboard and palette only ever surface
 * actions a user may actually take.
 */
export type QuickAction = {
  key: string;
  label: string;
  href: string;
  feature: string | null;
  permission: string | null;
  icon: string;
};

export const QUICK_ACTIONS: QuickAction[] = [
  {
    key: "create_shift",
    label: "Create Shift",
    href: "/app/schedule?new=1",
    feature: "shifts.tracking",
    permission: "shifts.schedule",
    icon: "CalendarClock",
  },
  {
    key: "publish_announcement",
    label: "Publish Announcement",
    href: "/app/announcements?new=1",
    feature: "announcements.management",
    permission: "announcement:manage",
    icon: "Megaphone",
  },
  {
    key: "review_applications",
    label: "Review Applications",
    href: "/app/applications",
    feature: "applications.basic",
    permission: "application:review",
    icon: "Briefcase",
  },
  {
    key: "assign_training",
    label: "Assign Training",
    href: "/app/training",
    feature: "training.basic",
    permission: "training:manage",
    icon: "BookOpen",
  },
  {
    key: "run_automation",
    label: "Automations",
    href: "/app/automations",
    feature: "automations.builder",
    permission: "automation.view",
    icon: "Workflow",
  },
  {
    key: "add_member",
    label: "Add Member",
    href: "/app/staff",
    feature: "core.members",
    permission: "member:invite",
    icon: "Users",
  },
  {
    key: "create_department",
    label: "Create Department",
    href: "/app/departments",
    feature: "core.departments",
    permission: "department:manage",
    icon: "Building2",
  },
  {
    key: "edit_website",
    label: "Edit Website",
    href: "/app/website",
    feature: "website.builder",
    permission: "organization:update",
    icon: "Globe",
  },
  {
    key: "open_cad",
    label: "Open CAD",
    href: "/app/cad",
    feature: "cad.access",
    permission: "cad.access",
    icon: "Shield",
  },
  {
    key: "live_server",
    label: "Live Server",
    href: "/app/live",
    feature: "server.live_status",
    permission: "erlc:view",
    icon: "Radio",
  },
];

/** Command-palette navigable destinations (searchable "go to" targets). */
export const PALETTE_DESTINATIONS: QuickAction[] = [
  {
    key: "nav_staff",
    label: "Members",
    href: "/app/staff",
    feature: "core.members",
    permission: "member:read",
    icon: "Users",
  },
  {
    key: "nav_departments",
    label: "Departments",
    href: "/app/departments",
    feature: "core.departments",
    permission: "department:read",
    icon: "Building2",
  },
  {
    key: "nav_applications",
    label: "Applications",
    href: "/app/applications",
    feature: "applications.basic",
    permission: "application:read",
    icon: "Briefcase",
  },
  {
    key: "nav_forms",
    label: "Forms",
    href: "/app/forms",
    feature: "forms.basic",
    permission: "application:read",
    icon: "FormInput",
  },
  {
    key: "nav_training",
    label: "Training",
    href: "/app/training",
    feature: "training.basic",
    permission: "training:read",
    icon: "BookOpen",
  },
  {
    key: "nav_schedule",
    label: "Schedule",
    href: "/app/schedule",
    feature: "shifts.tracking",
    permission: "shifts.attendance.view",
    icon: "CalendarClock",
  },
  {
    key: "nav_activity",
    label: "Activity",
    href: "/app/activity",
    feature: "activity.tracking",
    permission: "activity:read",
    icon: "Activity",
  },
  {
    key: "nav_announcements",
    label: "Announcements",
    href: "/app/announcements",
    feature: "announcements.management",
    permission: "announcement:read",
    icon: "Megaphone",
  },
  {
    key: "nav_automations",
    label: "Automations",
    href: "/app/automations",
    feature: "automations.builder",
    permission: "automation.view",
    icon: "Workflow",
  },
  {
    key: "nav_website",
    label: "Website",
    href: "/app/website",
    feature: "website.builder",
    permission: "organization:read",
    icon: "Globe",
  },
  {
    key: "nav_cad",
    label: "CAD / MDT",
    href: "/app/cad",
    feature: "cad.access",
    permission: "cad.access",
    icon: "Shield",
  },
  {
    key: "nav_live",
    label: "Live Server",
    href: "/app/live",
    feature: "server.live_status",
    permission: "erlc:view",
    icon: "Radio",
  },
  {
    key: "nav_assistant",
    label: "Ask Ordinex (AI)",
    href: "/app/assistant",
    feature: null,
    permission: "ai.use",
    icon: "Bot",
  },
  {
    key: "nav_knowledge",
    label: "Knowledge",
    href: "/app/knowledge",
    feature: null,
    permission: "knowledge.view",
    icon: "Library",
  },
  {
    key: "nav_settings",
    label: "Settings",
    href: "/app/settings",
    feature: null,
    permission: "organization:read",
    icon: "Settings",
  },
];

export function filterActions(
  actions: QuickAction[],
  hasFeature: (f: string) => boolean,
  canDo: (p: string) => boolean,
): QuickAction[] {
  return actions.filter(
    (a) =>
      (a.feature === null || hasFeature(a.feature)) &&
      (a.permission === null || canDo(a.permission)),
  );
}
