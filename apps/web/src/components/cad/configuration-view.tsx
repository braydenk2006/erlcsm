"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, CheckCircle2, Plus, RotateCcw, Save } from "lucide-react";
import { Badge, Button, Input, Label, cn } from "@commandry/ui";

type PenalCharge = {
  id: string;
  code: string;
  title: string;
  class: string;
  fine: number;
  jailMinutes: number;
  active: boolean;
};

type CadSettings = {
  enabled: boolean;
  version: "v1" | "v2";
  defaultLanding: string;
  enabledSections: string[];
  callNumberPrefix: string | null;
};

const ALL_SECTIONS = [
  "command",
  "dispatch",
  "mdt",
  "units",
  "calls",
  "persons",
  "vehicles",
  "records",
  "warrants",
  "bolos",
];

export function ConfigurationView({ onChange }: { onChange: () => void }) {
  const [settings, setSettings] = useState<CadSettings | null>(null);
  const [prefix, setPrefix] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetch("/api/cad/settings")
      .then((r) => r.json())
      .then((j) => {
        setSettings(j.settings);
        setPrefix(j.settings?.callNumberPrefix ?? "");
      });
  }, []);

  async function patch(body: Partial<CadSettings>) {
    const res = await fetch("/api/cad/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.settings) setSettings(json.settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onChange();
  }

  if (!settings) {
    return (
      <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-6 text-[var(--cmd-fg-muted)]">
        Loading configuration…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
          <h3 className="font-semibold">Module</h3>
          <p className="mt-1 text-sm text-[var(--cmd-fg-muted)]">
            Enable/disable the CAD module and choose the rewrite version (feature flag). v2 is the
            rewritten Command Center experience; v1 preserves the legacy behavior for rollback.
          </p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm">CAD enabled</span>
            <Button
              size="sm"
              variant={settings.enabled ? "secondary" : "outline"}
              onClick={() => void patch({ enabled: !settings.enabled })}
            >
              {settings.enabled ? "Enabled" : "Disabled"}
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm">Version</span>
            <div className="flex gap-1.5">
              {(["v1", "v2"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => void patch({ version: v })}
                  className={cn(
                    "rounded-[var(--cmd-radius)] px-3 py-1.5 text-sm",
                    settings.version === v
                      ? "cmd-gradient-fill"
                      : "border border-[var(--cmd-border)] text-[var(--cmd-fg-muted)]",
                  )}
                >
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-sm">Default landing</span>
            <select
              value={settings.defaultLanding}
              onChange={(e) => void patch({ defaultLanding: e.target.value })}
              className="h-9 rounded-[var(--cmd-radius-pill)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-3 text-sm"
            >
              {["command", "dispatch", "persons"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
          <h3 className="font-semibold">Sections & numbering</h3>
          <p className="mt-1 text-sm text-[var(--cmd-fg-muted)]">
            Choose which CAD sections are enabled and how call numbers are formatted.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ALL_SECTIONS.map((section) => {
              const on = settings.enabledSections.includes(section);
              return (
                <button
                  key={section}
                  onClick={() =>
                    void patch({
                      enabledSections: on
                        ? settings.enabledSections.filter((s) => s !== section)
                        : [...settings.enabledSections, section],
                    })
                  }
                  className={cn(
                    "rounded-[var(--cmd-radius-pill)] px-2.5 py-1 text-xs",
                    on
                      ? "cmd-gradient-fill"
                      : "border border-[var(--cmd-border)] text-[var(--cmd-fg-muted)]",
                  )}
                >
                  {section}
                </button>
              );
            })}
          </div>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="prefix">Call number prefix</Label>
            <div className="flex gap-2">
              <Input
                id="prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="e.g. PD"
                className="h-9 px-3 text-sm"
              />
              <Button size="sm" onClick={() => void patch({ callNumberPrefix: prefix || null })}>
                <Save className="h-4 w-4" />
                Save
              </Button>
            </div>
            <p className="text-xs text-[var(--cmd-fg-muted)]">
              Preview: {(prefix ? `${prefix}-` : "") + new Date().getUTCFullYear()}-000001
            </p>
          </div>
          {saved ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--cmd-success)]">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </p>
          ) : null}
          <div className="mt-3">
            <Badge tone="neutral">Version {settings.version.toUpperCase()}</Badge>
          </div>
        </div>
      </div>

      <PenalCodeCard />
    </div>
  );
}

function PenalCodeCard() {
  const [charges, setCharges] = useState<PenalCharge[]>([]);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [cls, setCls] = useState("Misdemeanor");
  const [fine, setFine] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/cad/penal-code?all=1", { cache: "no-store" });
    const json = await res.json();
    setCharges(json.penalCode ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addCharge() {
    if (!code.trim() || !title.trim()) return;
    await fetch("/api/cad/penal-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, title, class: cls, fine: fine ? Number(fine) : 0 }),
    });
    setCode("");
    setTitle("");
    setFine("");
    await load();
  }

  async function toggleArchive(charge: PenalCharge) {
    await fetch(`/api/cad/penal-code/${charge.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: charge.active }),
    });
    await load();
  }

  return (
    <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
      <h3 className="font-semibold">Penal code</h3>
      <p className="mt-1 text-sm text-[var(--cmd-fg-muted)]">
        Tenant-customizable charge catalogue (seeded from the Ordinex default). Used by citation and
        warrant charge pickers.
      </p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void addCharge();
        }}
      >
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code (e.g. F-310)"
          className="h-9 w-32 px-3 text-sm"
        />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="h-9 min-w-[180px] flex-1 px-3 text-sm"
        />
        <select
          value={cls}
          onChange={(e) => setCls(e.target.value)}
          className="h-9 rounded-[var(--cmd-radius-pill)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-3 text-sm"
        >
          {["Infraction", "Traffic", "Misdemeanor", "Felony"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Input
          value={fine}
          onChange={(e) => setFine(e.target.value)}
          placeholder="Fine $"
          className="h-9 w-24 px-3 text-sm"
          inputMode="numeric"
        />
        <Button size="sm" type="submit">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </form>
      <div className="mt-3 max-h-72 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <tbody>
            {charges.map((charge) => (
              <tr key={charge.id} className="border-b border-[var(--cmd-border)]/60">
                <td className="py-1.5 pr-2 font-[family-name:var(--cmd-font-mono)] text-xs">
                  {charge.code}
                </td>
                <td className="py-1.5 pr-2">{charge.title}</td>
                <td className="py-1.5 pr-2 text-[var(--cmd-fg-muted)]">{charge.class}</td>
                <td className="py-1.5 pr-2 text-[var(--cmd-fg-muted)]">${charge.fine}</td>
                <td className="py-1.5 pr-2">
                  {charge.active ? null : <Badge tone="neutral">archived</Badge>}
                </td>
                <td className="py-1.5 text-right">
                  <Button size="sm" variant="ghost" onClick={() => void toggleArchive(charge)}>
                    {charge.active ? (
                      <Archive className="h-3.5 w-3.5" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
