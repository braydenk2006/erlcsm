# Command Center (Phase 8)

The operational hub and default landing experience for authenticated users. It answers one
question immediately — **"what requires my attention right now?"** — by surfacing actionable,
prioritized information from every Ordinex subsystem. It is not a charts-and-stats dashboard; it is
mission control.

## 1. Architecture

```
/app  (default landing)
  → getDashboard(actor, org)                     [Dashboard API — one call]
     → manifest (plan-aware) + authorize (permission-aware)
     → batched aggregation (members, workflow, shifts, automation, website, departments, notifications, events)
     → Community Health Engine (deterministic)    [@commandry/command-center]
     → Executive Summary (deterministic)
     → widget registry filtered → personalized layout (DashboardPreference)
  → <CommandCenter/> renders widgets from the single payload
  → CommandPalette (Ctrl/⌘+K): search + quick actions + navigation
```

- **Pure domain** `@commandry/command-center`: the Community Health Engine, widget registry, quick
  actions + palette destinations, executive summary, and layout normalization. No IO — deterministic
  and unit-tested. Marketplace/plugin widgets register here without touching the page.
- **Dashboard API** `@commandry/api/command-center/dashboard`: one aggregation service
  (`getDashboard`) plus personalization (`saveDashboardLayout`/`resetDashboardLayout`) and
  `searchCommandPalette`/`getPaletteContext`.
- **Web**: the `/app` landing renders `<CommandCenter>`; the palette lives in the app shell.

## 2. Widget Registry

`WIDGETS` declares each widget's `feature` (entitlement), `permission`, `defaultSize`, and
`mobilePriority`. `visibleWidgets(hasFeature, canDo)` filters per user, so widgets are **never
hardcoded into the page** and only appear when the user's plan + permissions allow. Implemented
widgets: Community Health, Today at a glance (executive summary), Quick Actions, Notification Center,
Live Server, Upcoming Operations, Pending Applications, Training Progress, Workflow Queue, Automation
Health, Website Activity, Department Status, and Live Activity (event feed).

## 3. Dashboard API + Aggregation layer

`getDashboard` is the single, permission-checked, tenant-isolated aggregation. Widgets never query
dozens of endpoints — one batched `Promise.all` composes the whole payload (counts + the health
inputs + notifications + event feed), keeping the page fast and cache-ready. The payload carries each
widget's data, the personalized layout, filtered quick actions + palette destinations, and the
executive summary.

## 4. Community Health Engine

Deterministic and explainable (**no AI**). Eleven weighted factors — recruitment, staffing, training
completion, attendance, activity compliance, automation health, website activity, server
availability, pending approvals, outstanding workflows, and department staffing — each produce a
0-100 score, a severity band, a value, an explanation, and a **recommended action**. The overall
score is the weighted average; organizations can override weights (`computeHealth(inputs, weights)`).
Severity bands: `excellent ≥90 · healthy ≥75 · attention ≥60 · warning ≥40 · critical`. **Trend** is
deterministic: today's score is persisted to `HealthSnapshot` (one row per org per day) and compared
to the previous day (`trendFrom`).

## 5. Executive Summary

`buildExecutiveSummary` turns the snapshot into a short, urgency-ordered list of plain-language
sentences ("Five applications require review.", "Two operations begin within the next hour.", "The
linked ER:LC server is offline.") — deterministic, no AI. When nothing needs attention it returns a
single calm line.

## 6. Personalization

Per-user `DashboardPreference` stores a layout of `{ key, hidden, order, size }`. `normalizeLayout`
merges the saved layout with the widgets the user may currently see: preserves order/hidden/size,
drops widgets they lost access to, and appends newly-available widgets. Users can reorder, hide/show,
and reset; `mobileOrder` reprioritizes for small viewports.

## 7. Command Palette + Quick Actions

`CommandPalette` (Ctrl/⌘+K) is a universal, accessible overlay (role="dialog", arrow-key navigation,
Escape to close, focus management, reduced-motion aware). It combines server-side search
(`searchCommandPalette` over members/departments/announcements/automations — permission-aware,
tenant-isolated), Quick Actions, and navigation destinations. Quick Actions and destinations are
filtered by entitlement + permission (`filterActions`).

## 8. Permission + Plan model

Every widget, quick action, palette destination, and search category declares the permission +
entitlement it requires; the server enforces both. A Supervisor and an Owner therefore see different
dashboards from the same code. Tenant isolation is enforced at every query (organization-scoped).

## 9. Responsive + Accessibility

Responsive grid (1/2/3 columns; large widgets span two). Mobile ordering follows `mobilePriority`
(notifications, upcoming operations, pending approvals, quick actions, health, live server first).
Accessibility: ARIA labels on widgets and controls, keyboard-navigable palette, focus management,
and `motion-reduce` transitions.

## 10. Extension points (marketplace / plugins / AI)

- **New widgets**: add a `WidgetDef` to `WIDGETS` + a render branch — plan/permission gating is
  automatic. Marketplace/third-party/plugin widgets register the same way.
- **New quick actions / palette destinations**: add to the registries with a `feature` + `permission`.
- **New health factors**: extend `HEALTH_FACTOR_KEYS` + `FACTOR_META` + the scorer.
- **AI Assistant / predictive insights**: future AI widgets and an "ask" palette action plug into the
  same registries and aggregation payload without redesign — the engine itself stays deterministic.

## Testing

Unit (10): health determinism/bounds/weighting/bands/trend, executive summary, widget + quick-action
filtering, and layout normalization. Integration (5): full payload aggregation + deterministic score,
entitlement-based widget filtering (startup vs Growth), personalization persistence (hide + reset),
permission-aware palette search, and tenant isolation.

## Known limitations / follow-ups

- Reordering is button-based (up/down/hide/reset, persisted); true pointer drag-and-drop and multiple
  saved layouts are documented follow-ups.
- Some health inputs use pragmatic proxies (e.g. activity compliance = share of members with a
  participation event in 30 days; understaffed = department under 3 members). These are deterministic
  and documented; org-configurable thresholds are a follow-up.
- AI Assistant, predictive insights, marketplace widgets, and enterprise multi-org dashboards are
  architected-for but intentionally not implemented this phase.
