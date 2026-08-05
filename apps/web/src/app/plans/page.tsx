import Link from "next/link";
import { Fragment } from "react";
import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { Badge, Button } from "@commandry/ui";
import { PLANS, PLAN_ORDER, type PlanKey } from "@commandry/entitlements";
import { BrandMark } from "@/components/brand-mark";
import {
  buildComparison,
  buildLimitRows,
  cardHighlights,
  formatPrice,
  type CellStatus,
} from "./plans-data";

export const metadata: Metadata = {
  title: "Plans",
  description: "Ordinex plans that grow with your community — Start-Up, Growth, and Enterprise.",
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "Can I start for free?",
    a: "Yes. The Start-Up plan is free forever for new and small communities, with core server management and essential CAD/MDT included.",
  },
  {
    q: "Can I upgrade later?",
    a: "Yes. Upgrading is instant — new features and limits activate immediately and your existing data is preserved.",
  },
  {
    q: "What happens to my data if I downgrade?",
    a: "Nothing is deleted. Features that are no longer on your plan are hidden and become read-only, and your data is preserved for a documented retention period so you can export it or re-activate later.",
  },
  {
    q: "Is CAD included in Start-Up?",
    a: "Yes. Start-Up includes the CAD/MDT dispatch board, person and vehicle records, citations, warnings, warrants, BOLOs, and the penal code. Advanced CAD (evidence, court, fire/EMS, multi-agency) is on Growth.",
  },
  {
    q: "How are AI requests counted?",
    a: "Each AI action (for example a report summary) counts as one request against your monthly allowance, reset at the start of each billing period. AI features are rolling out — see the comparison for current availability.",
  },
  {
    q: "What does Enterprise include?",
    a: "Everything in Growth plus enterprise administration, advanced security controls, contract-defined limits, and priority support delivered through Enterprise onboarding.",
  },
  {
    q: "Are annual plans available?",
    a: "Monthly billing is available today. Annual billing is on the roadmap and will be offered once the billing integration is live.",
  },
  {
    q: "Are there setup fees?",
    a: "No setup fees. Enterprise engagements may include optional guided onboarding and migration assistance.",
  },
  {
    q: "Can I cancel at any time?",
    a: "Yes. You can cancel anytime; access continues until the end of the current billing period, then the organization returns to the free Start-Up plan with your data preserved.",
  },
  {
    q: "Are future features automatically included?",
    a: "Features marked \u201cComing Soon\u201d for your plan are included automatically when they ship — no price change and no migration required.",
  },
  {
    q: "What happens when I reach a limit?",
    a: "You'll be prevented from exceeding the limit (for example inviting past your member cap) and prompted to upgrade. Existing data is never removed to enforce a limit.",
  },
];

function PublicNav() {
  return (
    <header className="cmd-glass-strong mx-auto mt-6 flex max-w-6xl items-center justify-between gap-4 rounded-[var(--cmd-radius-pill)] px-4 py-2.5">
      <Link href="/" className="flex items-center gap-2">
        <BrandMark size={32} />
        <span className="font-[family-name:var(--cmd-font-display)] text-lg font-semibold tracking-[0.06em]">
          Ordinex
        </span>
      </Link>
      <nav className="hidden items-center gap-5 text-sm text-[var(--cmd-fg-muted)] md:flex">
        <Link href="/" className="hover:text-[var(--cmd-fg)]">
          Home
        </Link>
        <Link href="/plans" className="text-[var(--cmd-fg)]">
          Plans
        </Link>
        <Link href="/docs/status" className="hover:text-[var(--cmd-fg)]">
          Documentation
        </Link>
      </nav>
      <Button asChild size="sm">
        <Link href="/sign-in">Sign In</Link>
      </Button>
    </header>
  );
}

function StatusCell({ status }: { status: CellStatus }) {
  if (status === "included")
    return <Check className="mx-auto h-4 w-4 text-[var(--cmd-success)]" aria-label="Included" />;
  if (status === "partial")
    return <span className="text-xs text-[var(--cmd-accent)]">Partial</span>;
  if (status === "soon") return <span className="text-xs text-[var(--cmd-fg-muted)]">Soon</span>;
  return <Minus className="mx-auto h-4 w-4 text-[var(--cmd-border)]" aria-label="Not included" />;
}

function PricingCard({ planKey }: { planKey: PlanKey }) {
  const plan = PLANS[planKey];
  const price = formatPrice(planKey);
  const popular = planKey === "growth";
  const highlights = cardHighlights(planKey);
  const cta =
    planKey === "startup" ? "/sign-in" : planKey === "growth" ? "/sign-in" : "/plans#contact";

  return (
    <div
      className={`cmd-glass relative flex flex-col rounded-[var(--cmd-radius-xl)] p-6 ${
        popular ? "border-[var(--cmd-accent)] shadow-[0_16px_40px_rgba(59,108,255,0.2)]" : ""
      }`}
    >
      {popular ? (
        <span className="absolute -top-3 left-6">
          <Badge tone="accent">Most Popular</Badge>
        </span>
      ) : null}
      <h3 className="font-[family-name:var(--cmd-font-display)] text-2xl">{plan.name}</h3>
      <p className="mt-1 text-sm text-[var(--cmd-fg-muted)]">{plan.tagline}</p>
      <div className="mt-4 flex items-end gap-1">
        <span className="text-3xl font-semibold">
          {plan.contactSales ? "From " : ""}
          {price.amount}
        </span>
        {price.suffix ? (
          <span className="mb-1 text-sm text-[var(--cmd-fg-muted)]">{price.suffix}</span>
        ) : null}
      </div>
      <Button asChild className="mt-5 w-full" variant={popular ? "primary" : "outline"}>
        <Link href={cta}>{plan.cta}</Link>
      </Button>
      <ul className="mt-5 space-y-2 text-sm">
        {highlights.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cmd-success)]" />
            <span>{item}</span>
          </li>
        ))}
        <li className="flex items-start gap-2 text-[var(--cmd-fg-muted)]">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cmd-success)]" />
          <span>
            {plan.limits["members.max"] >= 1_000_000_000
              ? "Contract"
              : plan.limits["members.max"].toLocaleString()}{" "}
            members
          </span>
        </li>
      </ul>
    </div>
  );
}

export default function PlansPage() {
  const comparison = buildComparison();
  const limitRows = buildLimitRows();

  return (
    <main id="main" className="min-h-screen px-5 pb-24 md:px-8">
      <PublicNav />

      <section className="mx-auto mt-16 max-w-3xl text-center">
        <h1 className="font-[family-name:var(--cmd-font-display)] text-4xl font-semibold tracking-[-0.02em] md:text-6xl">
          Plans that grow with your community.
        </h1>
        <p className="mt-4 text-lg text-[var(--cmd-fg-muted)]">
          Start free, unlock advanced operations as your community grows, and scale across multiple
          servers with Ordinex Enterprise.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/sign-in">Start for Free</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#compare">Compare plans</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto mt-14 grid max-w-6xl gap-5 md:grid-cols-3">
        {PLAN_ORDER.map((planKey) => (
          <PricingCard key={planKey} planKey={planKey} />
        ))}
      </section>

      <section id="compare" className="mx-auto mt-20 max-w-6xl">
        <h2 className="font-[family-name:var(--cmd-font-display)] text-3xl">Compare every plan</h2>
        <p className="mt-2 text-sm text-[var(--cmd-fg-muted)]">
          Generated from Ordinex&apos;s live capability registry. Features still in development are
          marked <span className="text-[var(--cmd-fg)]">Soon</span> and are never shown as included.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--cmd-border)]">
                <th className="py-3 pr-4 font-medium">Capability</th>
                {PLAN_ORDER.map((planKey) => (
                  <th key={planKey} className="px-4 py-3 text-center font-semibold">
                    {PLANS[planKey].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((group) => (
                <Fragment key={group.key}>
                  <tr className="bg-[var(--cmd-bg-muted)]">
                    <td
                      colSpan={4}
                      className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-[var(--cmd-fg-muted)]"
                    >
                      {group.label}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.feature} className="border-b border-[var(--cmd-border)]/50">
                      <td className="py-2 pr-4">{row.label}</td>
                      {PLAN_ORDER.map((planKey) => (
                        <td key={planKey} className="px-4 py-2 text-center">
                          <StatusCell status={row.cells[planKey]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr className="bg-[var(--cmd-bg-muted)]">
                <td
                  colSpan={4}
                  className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-[var(--cmd-fg-muted)]"
                >
                  Limits
                </td>
              </tr>
              {limitRows.map((row) => (
                <tr key={row.label} className="border-b border-[var(--cmd-border)]/50">
                  <td className="py-2 pr-4">{row.label}</td>
                  {PLAN_ORDER.map((planKey) => (
                    <td key={planKey} className="px-4 py-2 text-center text-[var(--cmd-fg-muted)]">
                      {row.cells[planKey]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto mt-20 grid max-w-6xl gap-5 md:grid-cols-3">
        {PLAN_ORDER.map((planKey) => (
          <div key={planKey} className="cmd-glass rounded-[var(--cmd-radius-xl)] p-6">
            <h3 className="font-semibold">{PLANS[planKey].name} is recommended for</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-[var(--cmd-fg-muted)]">
              {PLANS[planKey].recommendedFor.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cmd-accent)]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section id="contact" className="mx-auto mt-20 max-w-3xl">
        <h2 className="font-[family-name:var(--cmd-font-display)] text-3xl">
          Frequently asked questions
        </h2>
        <div className="mt-6 space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="cmd-glass rounded-[var(--cmd-radius)] p-4 [&_summary]:cursor-pointer"
            >
              <summary className="font-medium">{item.q}</summary>
              <p className="mt-2 text-sm text-[var(--cmd-fg-muted)]">{item.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Button asChild size="lg">
            <Link href="/sign-in">Start for Free</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
