# Insights & Recommendations Engine (Phase 9)

A **deterministic** intelligence layer between the Command Center and the future AI Assistant. It
continuously analyzes every subsystem and produces explainable KPIs, trends, insights,
recommendations, goals, community-health factors, and alerts — **no AI, no LLMs, no probabilistic
inference**. Every output traces back to measured platform data.

## 1. Architecture

```
Organizations / Operations / Workflow / Automation / Website
   → aggregateMetrics(org)              [one batched, tenant-isolated read]
      → KPI Engine (evaluate vs target + trend + severity + evidence)
      → Community Health Engine (Phase 8) → grouped factor categories
      → Insight builder (off-target / notable-trend KPIs → insights)
      → Recommendation Engine (deterministic rules → justified actions)
      → Alert Engine (warning/critical insights → alerts, idempotent/day)
      → Goal Engine (progress + straight-line projection)
   → getInsightsBundle()                [the intelligence the UI + future AI consume]
      → Command Center widgets + /app/insights + /api/*
```

- **Pure domain** `@commandry/insights` (14 unit tests): Trend Engine, KPI registry + evaluator,
  threshold/severity, Recommendation rules, Goal Engine (deterministic projection), Alert lifecycle,
  and the insight/health-grouping/summary builders. All pure — deterministic and unit-tested.
- **Service** `@commandry/api/insights`: `getInsightsBundle`, goals CRUD + evaluation, alerts, department
  insights, and the timeline. Persists KPI/day snapshots (`KpiSnapshot`), append-only insight history
  (`InsightRecord`), and alerts (`Alert`).

## 2. Trend Engine

`computeTrend(current, previous, direction, thresholds)` classifies movement as `improving`,
`stable`, `declining`, `rapid_improvement`, `rapid_decline`, or `insufficient_data`, and **explains
how** it was derived (percent change vs the stable/rapid bands). `direction` encodes whether higher is
better (attendance) or lower is better (backlog). Trends compare today's value to the most recent
prior daily `KpiSnapshot`, over configurable periods (24h/7d/30d/90d/365d/custom).

## 3. KPI Engine

`KPI_DEFS` registers reusable KPIs (attendance, training completion, automation success, community
health, website visitors, application backlog, avg review time, active members, department staffing,
automation failures, recruitment). `evaluateKpi` attaches current/previous/target/trend/severity and
an **evidence** string. New modules register KPIs without touching the engine.

## 4. Recommendation Engine

`RECOMMENDATION_RULES` maps a KPI condition to a **justified** recommendation and concrete module
actions (e.g. review-time over target → "Assign another reviewer" + `Review applications`). A rule
only fires when its KPI is off-target or declining — **no recommendation is produced without
supporting data**, and each carries its `reason` (the KPI evidence).

## 5. Goal Engine

Organizations set operational goals (`Goal`) bound to a KPI + target (org/department/role scope,
optional due date, recurring). `evaluateGoal` returns progress (from baseline), on-target, trend,
severity, a **deterministic straight-line projection** of days-to-target (from the measured daily
rate — null when not moving toward target, never AI-forecast), and a recommendation.

## 6. Community Health expansion

Reuses the Phase 8 engine's 11 weighted factors and **groups** them into higher-level categories
(Recruitment, Training, Operations, Automation, Website, Workflow, Departments) — each with a weighted
score, and each factor exposing weight/score/trend/target/explanation/recommendation/evidence.

## 7. Alert Engine

`shouldRaiseAlert` gates warning/critical insights into `Alert` rows (idempotent per
`(org, insightKey, day)`). `alertLevelForSeverity` maps to information/success/attention/warning/
critical. Lifecycle: `open → acknowledged/escalated → resolved/dismissed/expired`, enforced by
`canTransitionAlert`. Alerts surface in the Command Center and are managed on `/app/insights`.

## 8. Insight Timeline / History

Every computed insight is upserted to `InsightRecord` (idempotent per key/day), giving a filterable
history (`getInsightTimeline` by category/severity/date). Executive summaries are built
deterministically from the structured insights + the day-over-day health delta.

## 9. Dashboard integration + API

Command Center widgets (permission-filtered): Alerts, Recommendations, Key Metrics (KPIs), Goals,
Insights — all fed from the **single** `getInsightsBundle` (widgets never recompute). APIs:
`GET /api/insights`, `/api/kpis`, `/api/recommendations`, `/api/community-health`,
`GET|POST /api/goals`, `DELETE /api/goals/:id`, `GET /api/alerts`, `PATCH /api/alerts/:id`,
`GET /api/departments/:id/insights`.

## 10. Permissions

`insights.view`, `kpis.view`, `recommendations.view`, `department.insights` (viewing) and
`goals.manage`, `alerts.manage` (management) — organization-aware, server-enforced, tenant-isolated.
Owners/admins get management; a staff view role gets read access.

## 11. Extension points + future AI

Registries make growth additive with no redesign: new **KPIs** (`KPI_DEFS`), **recommendation rules**
(`RECOMMENDATION_RULES`), **health factors** (Phase 8 engine), **trend sources** (any KPI), and **alert
types**. A future **AI Assistant consumes** the bundle — insights, recommendations, goals, KPIs,
community health, alert/trend history, executive summaries — and **explains** these trusted,
deterministic outputs rather than recalculating or inventing them.

## Testing

Unit (14): trend classification/explanations, KPI evaluation + direction-aware severity, deterministic
recommendations (only when justified), goal progress + projection + null-projection, alert
level-mapping + lifecycle, insight building + health grouping + summary. Integration (6): deterministic
bundle with evidence on every item, data-backed recommendation + alert on an understaffed department,
historical trend from a prior snapshot, goal progress/projection, alert lifecycle transitions, and
department insights + tenant isolation.

## Known limitations / follow-ups

- Trends/projections use **daily** snapshots; sub-day trend and richer custom ranges are follow-ups.
- Some KPIs use pragmatic deterministic proxies (activity compliance = share of members with a 30-day
  participation event; understaffed = department under 3 members). Org-configurable thresholds and
  weights are a follow-up.
- Department insights currently cover staffing/leadership; per-department attendance/training rollups
  are a follow-up.
- AI, predictive forecasting, and marketplace insight packs are architected-for but intentionally not
  implemented this phase.
