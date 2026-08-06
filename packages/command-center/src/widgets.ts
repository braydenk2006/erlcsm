/**
 * Widget registry — widgets are never hardcoded into the page. Each declares the
 * entitlement + permission it needs, a default size, and a mobile priority. The
 * dashboard filters this registry per user (plan-aware + permission-aware) and
 * merges it with the user's saved layout. Marketplace/plugin widgets register here.
 */

export type WidgetSize = "sm" | "md" | "lg";

export type WidgetDef = {
  key: string;
  title: string;
  category: "overview" | "operations" | "people" | "platform" | "content";
  /** Entitlement capability key required (string to avoid a hard dep on the registry). */
  feature: string | null;
  /** Permission action required (string; validated against the shared engine). */
  permission: string | null;
  defaultSize: WidgetSize;
  /** Lower = higher priority on mobile. */
  mobilePriority: number;
  defaultVisible: boolean;
};

export const WIDGETS: WidgetDef[] = [
  {
    key: "community_health",
    title: "Community Health",
    category: "overview",
    feature: null,
    permission: "organization:read",
    defaultSize: "lg",
    mobilePriority: 5,
    defaultVisible: true,
  },
  {
    key: "executive_summary",
    title: "Today at a glance",
    category: "overview",
    feature: null,
    permission: "organization:read",
    defaultSize: "md",
    mobilePriority: 2,
    defaultVisible: true,
  },
  {
    key: "quick_actions",
    title: "Quick Actions",
    category: "overview",
    feature: null,
    permission: "organization:read",
    defaultSize: "md",
    mobilePriority: 4,
    defaultVisible: true,
  },
  {
    key: "notifications",
    title: "Notification Center",
    category: "overview",
    feature: null,
    permission: "organization:read",
    defaultSize: "md",
    mobilePriority: 1,
    defaultVisible: true,
  },
  {
    key: "live_server",
    title: "Live Server",
    category: "operations",
    feature: "server.live_status",
    permission: "erlc:view",
    defaultSize: "md",
    mobilePriority: 6,
    defaultVisible: true,
  },
  {
    key: "upcoming_operations",
    title: "Upcoming Operations",
    category: "operations",
    feature: "shifts.tracking",
    permission: "shifts.attendance.view",
    defaultSize: "md",
    mobilePriority: 3,
    defaultVisible: true,
  },
  {
    key: "pending_applications",
    title: "Pending Applications",
    category: "people",
    feature: "applications.basic",
    permission: "application:read",
    defaultSize: "md",
    mobilePriority: 4,
    defaultVisible: true,
  },
  {
    key: "training_progress",
    title: "Training Progress",
    category: "people",
    feature: "training.basic",
    permission: "training:read",
    defaultSize: "md",
    mobilePriority: 8,
    defaultVisible: true,
  },
  {
    key: "workflow_queue",
    title: "Workflow Queue",
    category: "platform",
    feature: "forms.basic",
    permission: "application:read",
    defaultSize: "md",
    mobilePriority: 7,
    defaultVisible: true,
  },
  {
    key: "automation_health",
    title: "Automation Health",
    category: "platform",
    feature: "automations.builder",
    permission: "automation.view",
    defaultSize: "md",
    mobilePriority: 9,
    defaultVisible: true,
  },
  {
    key: "website_activity",
    title: "Website Activity",
    category: "content",
    feature: "website.builder",
    permission: "organization:read",
    defaultSize: "md",
    mobilePriority: 11,
    defaultVisible: true,
  },
  {
    key: "department_status",
    title: "Department Status",
    category: "people",
    feature: "core.departments",
    permission: "department:read",
    defaultSize: "lg",
    mobilePriority: 10,
    defaultVisible: true,
  },
  {
    key: "event_feed",
    title: "Live Activity",
    category: "platform",
    feature: null,
    permission: "organization:read",
    defaultSize: "md",
    mobilePriority: 12,
    defaultVisible: true,
  },
  // Insights & Recommendations Engine (Phase 9)
  {
    key: "alerts",
    title: "Alerts",
    category: "overview",
    feature: null,
    permission: "insights.view",
    defaultSize: "md",
    mobilePriority: 2,
    defaultVisible: true,
  },
  {
    key: "recommendations",
    title: "Recommendations",
    category: "overview",
    feature: null,
    permission: "recommendations.view",
    defaultSize: "lg",
    mobilePriority: 3,
    defaultVisible: true,
  },
  {
    key: "kpis",
    title: "Key Metrics",
    category: "platform",
    feature: null,
    permission: "kpis.view",
    defaultSize: "lg",
    mobilePriority: 6,
    defaultVisible: true,
  },
  {
    key: "goals",
    title: "Goals",
    category: "platform",
    feature: null,
    permission: "insights.view",
    defaultSize: "md",
    mobilePriority: 7,
    defaultVisible: true,
  },
  {
    key: "insights_feed",
    title: "Insights",
    category: "platform",
    feature: null,
    permission: "insights.view",
    defaultSize: "md",
    mobilePriority: 8,
    defaultVisible: true,
  },
  // Knowledge Platform + AI Assistant (Phase 10)
  {
    key: "ai_assistant",
    title: "Ask Ordinex",
    category: "overview",
    feature: null,
    permission: "ai.use",
    defaultSize: "md",
    mobilePriority: 1,
    defaultVisible: true,
  },
];

export function widgetByKey(key: string): WidgetDef | undefined {
  return WIDGETS.find((w) => w.key === key);
}

/** Filter widgets a user can actually see (plan-aware + permission-aware). */
export function visibleWidgets(
  hasFeature: (f: string) => boolean,
  canDo: (p: string) => boolean,
): WidgetDef[] {
  return WIDGETS.filter(
    (w) =>
      (w.feature === null || hasFeature(w.feature)) &&
      (w.permission === null || canDo(w.permission)),
  );
}

// ---------------------------------------------------------------------------
// Layout personalization
// ---------------------------------------------------------------------------

export type WidgetLayoutItem = { key: string; hidden: boolean; order: number; size: WidgetSize };

/**
 * Merge a user's saved layout with the set of widgets they may currently see:
 * preserves saved order/hidden/size, drops widgets they no longer have access
 * to, and appends newly-available widgets at the end in registry order.
 */
export function normalizeLayout(
  saved: WidgetLayoutItem[] | null | undefined,
  available: WidgetDef[],
): WidgetLayoutItem[] {
  const availableKeys = new Set(available.map((w) => w.key));
  const savedByKey = new Map(
    (saved ?? []).filter((s) => availableKeys.has(s.key)).map((s) => [s.key, s]),
  );
  const kept = [...savedByKey.values()].sort((a, b) => a.order - b.order);
  const missing = available
    .filter((w) => !savedByKey.has(w.key))
    .map((w, idx) => ({
      key: w.key,
      hidden: !w.defaultVisible,
      order: kept.length + idx,
      size: w.defaultSize,
    }));
  return [...kept, ...missing].map((item, idx) => ({ ...item, order: idx }));
}

/** Order widgets for a mobile viewport (by declared mobile priority). */
export function mobileOrder(layout: WidgetLayoutItem[]): WidgetLayoutItem[] {
  return [...layout].sort(
    (a, b) =>
      (widgetByKey(a.key)?.mobilePriority ?? 99) - (widgetByKey(b.key)?.mobilePriority ?? 99),
  );
}
