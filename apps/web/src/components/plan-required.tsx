import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@commandry/ui";
import {
  PLANS,
  capabilityLabel,
  requiredPlanForFeature,
  type CapabilityKey,
} from "@commandry/entitlements";

/**
 * Clean plan-information page shown when a user navigates directly to a route for
 * a capability their plan does not include. It renders outside the feature UI,
 * exposes no feature data, and links to the Plans page.
 */
export function PlanRequired({ feature }: { feature: CapabilityKey }) {
  const requiredPlan = requiredPlanForFeature(feature);
  const planName = requiredPlan ? PLANS[requiredPlan].name : "a higher";

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)]">
        <Lock className="h-6 w-6 text-[var(--cmd-accent)]" />
      </div>
      <h1 className="font-[family-name:var(--cmd-font-display)] text-2xl">
        {capabilityLabel(feature)}
        {" isn\u2019t on your plan"}
      </h1>
      <p className="max-w-md text-[var(--cmd-fg-muted)]">
        {capabilityLabel(feature)} is available on the <strong>{planName}</strong> plan. Upgrade to
        unlock it for your organization.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/plans">View plans</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/app">Back to workspace</Link>
        </Button>
      </div>
    </div>
  );
}
