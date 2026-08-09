"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Car,
  Eye,
  LayoutDashboard,
  Radio,
  Settings,
  ShieldAlert,
  Users,
  UsersRound,
} from "lucide-react";
import { cn } from "@commandry/ui";
import type { CadSummary } from "./types";
import { CommandCenterView } from "./command-center-view";
import { DispatchView } from "./dispatch-view";
import { CiviliansView } from "./civilians-view";
import { VehiclesView } from "./vehicles-view";
import { WarrantsView } from "./warrants-view";
import { BolosView } from "./bolos-view";
import { PersonnelView } from "./personnel-view";
import { ConfigurationView } from "./configuration-view";

const TABS = [
  { key: "command", label: "Command", icon: LayoutDashboard },
  { key: "dispatch", label: "Dispatch", icon: Radio },
  { key: "persons", label: "Persons", icon: Users },
  { key: "vehicles", label: "Vehicles", icon: Car },
  { key: "warrants", label: "Warrants", icon: ShieldAlert },
  { key: "bolos", label: "BOLOs", icon: Eye },
  { key: "personnel", label: "Personnel", icon: UsersRound },
  { key: "configuration", label: "Configuration", icon: Settings },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="cmd-glass rounded-[var(--cmd-radius)] px-4 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-[var(--cmd-fg-muted)]">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

export function CadWorkspace({ defaultLanding = "command" }: { defaultLanding?: string }) {
  const initialTab = (TABS.find((t) => t.key === defaultLanding)?.key ?? "command") as TabKey;
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [summary, setSummary] = useState<CadSummary | null>(null);

  const refreshSummary = useCallback(async () => {
    const res = await fetch("/api/cad/summary", { cache: "no-store" });
    const json = await res.json();
    setSummary(json.summary ?? null);
  }, []);

  useEffect(() => {
    void refreshSummary();
  }, [refreshSummary]);

  return (
    <div className="space-y-5">
      {tab !== "command" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Units on duty" value={summary?.unitsOnDuty ?? "—"} />
          <Stat label="Active calls" value={summary?.activeCalls ?? "—"} />
          <Stat label="Active warrants" value={summary?.activeWarrants ?? "—"} />
          <Stat label="Active BOLOs" value={summary?.activeBolos ?? "—"} />
          <Stat label="Persons" value={summary?.civilians ?? "—"} />
          <Stat label="Vehicles" value={summary?.vehicles ?? "—"} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--cmd-radius)] px-3.5 py-2 text-sm transition",
                tab === t.key
                  ? "cmd-gradient-fill"
                  : "text-[var(--cmd-fg-muted)] hover:bg-[var(--cmd-bg-muted)]",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "command" ? <CommandCenterView /> : null}
      {tab === "dispatch" ? <DispatchView onChange={refreshSummary} /> : null}
      {tab === "persons" ? <CiviliansView onChange={refreshSummary} /> : null}
      {tab === "vehicles" ? <VehiclesView onChange={refreshSummary} /> : null}
      {tab === "warrants" ? <WarrantsView onChange={refreshSummary} /> : null}
      {tab === "bolos" ? <BolosView onChange={refreshSummary} /> : null}
      {tab === "personnel" ? <PersonnelView onChange={refreshSummary} /> : null}
      {tab === "configuration" ? <ConfigurationView onChange={refreshSummary} /> : null}
    </div>
  );
}
