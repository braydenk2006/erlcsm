"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Car,
  FileText,
  Plus,
  Scale,
  Search,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { Badge, Button, Input, Label, cn } from "@commandry/ui";
import type {
  CivilianDetail,
  CivilianSummary,
  LicenseStatus,
  PenalCharge,
  RecordType,
} from "./types";

const LICENSE_STATUSES: LicenseStatus[] = ["VALID", "SUSPENDED", "REVOKED", "EXPIRED", "NONE"];
const RECORD_TYPES: RecordType[] = ["CITATION", "ARREST", "INCIDENT", "WARNING"];

function licenseTone(status: LicenseStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "VALID") return "success";
  if (status === "SUSPENDED" || status === "EXPIRED") return "warning";
  if (status === "REVOKED") return "danger";
  return "neutral";
}

function warrantTone(state: string): "success" | "warning" | "danger" | "neutral" | "accent" {
  if (state === "ACTIVE") return "danger";
  if (state === "APPROVED") return "warning";
  if (state === "SUBMITTED" || state === "UNDER_REVIEW") return "accent";
  return "neutral";
}

function recordTone(status: string): "success" | "warning" | "danger" | "neutral" | "accent" {
  if (status === "APPROVED" || status === "LOCKED") return "success";
  if (status === "SUBMITTED" || status === "UNDER_REVIEW") return "accent";
  if (status === "REVISION_REQUESTED") return "warning";
  if (status === "REJECTED") return "danger";
  return "neutral";
}

function ChargePicker({
  penalCode,
  charges,
  setCharges,
}: {
  penalCode: PenalCharge[];
  charges: string[];
  setCharges: (next: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <select
        className="h-9 w-full rounded-[var(--cmd-radius-sm)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-xs"
        value=""
        onChange={(e) => {
          const label = e.target.value;
          if (label && !charges.includes(label)) setCharges([...charges, label]);
        }}
      >
        <option value="">+ Add charge…</option>
        {penalCode.map((c) => (
          <option key={c.code} value={`${c.code} ${c.title}`}>
            {c.code} · {c.title} ({c.class})
          </option>
        ))}
      </select>
      {charges.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {charges.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCharges(charges.filter((x) => x !== c))}
              className="rounded-[var(--cmd-radius-pill)] border border-[var(--cmd-border)] px-2 py-0.5 text-[11px] hover:border-[var(--cmd-danger)]"
            >
              {c} ✕
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CiviliansView({ onChange }: { onChange: () => void }) {
  const [list, setList] = useState<CivilianSummary[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CivilianDetail | null>(null);
  const [penalCode, setPenalCode] = useState<PenalCharge[]>([]);
  const [showNew, setShowNew] = useState(false);

  const search = useCallback(async (q: string) => {
    const res = await fetch(`/api/cad/civilians?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    const json = await res.json();
    setList(json.civilians ?? []);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/cad/civilians/${id}`, { cache: "no-store" });
    const json = await res.json();
    setDetail(json.civilian ?? null);
  }, []);

  useEffect(() => {
    void search("");
    void fetch("/api/cad/penal-code")
      .then((r) => r.json())
      .then((j) => setPenalCode(j.penalCode ?? []));
  }, [search]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <div className="cmd-glass h-max rounded-[var(--cmd-radius-xl)] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold">Civilians</h3>
          <Button size="sm" variant="outline" onClick={() => setShowNew((v) => !v)}>
            <UserPlus className="h-4 w-4" />
            New
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cmd-fg-muted)]" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              void search(e.target.value);
            }}
            placeholder="Search name or Roblox user"
            className="h-9 pl-9 text-sm"
          />
        </div>

        {showNew ? (
          <NewCivilianForm
            onCreated={async () => {
              setShowNew(false);
              await search("");
              onChange();
            }}
          />
        ) : null}

        <ul className="mt-3 space-y-1.5">
          {list.length === 0 ? (
            <li className="text-xs text-[var(--cmd-fg-muted)]">No civilians found.</li>
          ) : (
            list.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[var(--cmd-radius)] border p-2.5 text-left",
                    selectedId === c.id
                      ? "border-[var(--cmd-accent)] bg-[var(--cmd-bg-muted)]"
                      : "border-[var(--cmd-border)] hover:bg-[var(--cmd-bg-muted)]",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.firstName} {c.lastName}
                    </p>
                    {c.robloxUsername ? (
                      <p className="truncate text-[11px] text-[var(--cmd-fg-muted)]">
                        @{c.robloxUsername}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {c.warrantCount > 0 ? <Badge tone="danger">{c.warrantCount} WNT</Badge> : null}
                    <Badge tone={licenseTone(c.licenseStatus)}>{c.licenseStatus}</Badge>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
        {!detail ? (
          <p className="text-sm text-[var(--cmd-fg-muted)]">
            Select a civilian to view their record, vehicles, warrants, and citations.
          </p>
        ) : (
          <CivilianDetailPanel
            detail={detail}
            penalCode={penalCode}
            reload={() => selectedId && loadDetail(selectedId)}
            onChange={onChange}
          />
        )}
      </div>
    </div>
  );
}

function NewCivilianForm({ onCreated }: { onCreated: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [roblox, setRoblox] = useState("");

  return (
    <form
      className="mt-3 space-y-2 rounded-[var(--cmd-radius)] border border-dashed border-[var(--cmd-border)] p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!firstName.trim() || !lastName.trim()) return;
        await fetch("/api/cad/civilians", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            firstName,
            lastName,
            dateOfBirth: dob || undefined,
            robloxUsername: roblox || undefined,
          }),
        });
        onCreated();
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          className="h-9 px-3 text-sm"
        />
        <Input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          className="h-9 px-3 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          placeholder="DOB (YYYY-MM-DD)"
          className="h-9 px-3 text-sm"
        />
        <Input
          value={roblox}
          onChange={(e) => setRoblox(e.target.value)}
          placeholder="Roblox user"
          className="h-9 px-3 text-sm"
        />
      </div>
      <Button size="sm" type="submit" className="w-full">
        <Plus className="h-4 w-4" />
        Create civilian
      </Button>
    </form>
  );
}

function CivilianDetailPanel({
  detail,
  penalCode,
  reload,
  onChange,
}: {
  detail: CivilianDetail;
  penalCode: PenalCharge[];
  reload: () => void;
  onChange: () => void;
}) {
  const [tab, setTab] = useState<"vehicles" | "warrants" | "records">("vehicles");

  async function setLicense(status: LicenseStatus) {
    await fetch(`/api/cad/civilians/${detail.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ licenseStatus: status }),
    });
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--cmd-font-display)] text-2xl">
            {detail.firstName} {detail.lastName}
          </h2>
          <p className="text-sm text-[var(--cmd-fg-muted)]">
            {detail.dateOfBirth ? `DOB ${detail.dateOfBirth.slice(0, 10)}` : "DOB unknown"}
            {detail.robloxUsername ? ` · @${detail.robloxUsername}` : ""}
          </p>
          {detail.flags.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {detail.flags.map((f) => (
                <Badge key={f} tone="danger">
                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                  {f}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="lic" className="text-xs text-[var(--cmd-fg-muted)]">
            License
          </Label>
          <select
            id="lic"
            value={detail.licenseStatus}
            onChange={(e) => void setLicense(e.target.value as LicenseStatus)}
            className="h-9 rounded-[var(--cmd-radius-pill)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-3 text-sm"
          >
            {LICENSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-1.5">
        {[
          { key: "vehicles" as const, label: "Vehicles", icon: Car, count: detail.vehicles.length },
          {
            key: "warrants" as const,
            label: "Warrants",
            icon: ShieldAlert,
            count: detail.warrants.length,
          },
          {
            key: "records" as const,
            label: "Records",
            icon: FileText,
            count: detail.records.length,
          },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--cmd-radius)] px-3 py-1.5 text-sm",
                tab === t.key
                  ? "cmd-gradient-fill"
                  : "text-[var(--cmd-fg-muted)] hover:bg-[var(--cmd-bg-muted)]",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label} ({t.count})
            </button>
          );
        })}
      </div>

      {tab === "vehicles" ? (
        <VehiclesTab detail={detail} reload={reload} onChange={onChange} />
      ) : null}
      {tab === "warrants" ? (
        <WarrantsTab detail={detail} penalCode={penalCode} reload={reload} onChange={onChange} />
      ) : null}
      {tab === "records" ? (
        <RecordsTab detail={detail} penalCode={penalCode} reload={reload} onChange={onChange} />
      ) : null}
    </div>
  );
}

function VehiclesTab({
  detail,
  reload,
  onChange,
}: {
  detail: CivilianDetail;
  reload: () => void;
  onChange: () => void;
}) {
  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");

  return (
    <div className="space-y-3">
      {detail.vehicles.length === 0 ? (
        <p className="text-sm text-[var(--cmd-fg-muted)]">No registered vehicles.</p>
      ) : (
        <ul className="space-y-2">
          {detail.vehicles.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] p-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {v.plate} · {v.model}
                  {v.color ? ` (${v.color})` : ""}
                </p>
                <p className="text-xs text-[var(--cmd-fg-muted)]">
                  Reg {v.registration} · Ins {v.insurance}
                </p>
              </div>
              {v.stolen ? <Badge tone="danger">STOLEN</Badge> : <Badge tone="success">CLEAR</Badge>}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap gap-2 rounded-[var(--cmd-radius)] border border-dashed border-[var(--cmd-border)] p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!plate.trim() || !model.trim()) return;
          await fetch("/api/cad/vehicles", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              plate,
              model,
              color: color || undefined,
              ownerCivilianId: detail.id,
            }),
          });
          setPlate("");
          setModel("");
          setColor("");
          reload();
          onChange();
        }}
      >
        <Input
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="Plate"
          className="h-9 w-28 px-3 text-sm"
        />
        <Input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Model"
          className="h-9 flex-1 px-3 text-sm"
        />
        <Input
          value={color}
          onChange={(e) => setColor(e.target.value)}
          placeholder="Color"
          className="h-9 w-24 px-3 text-sm"
        />
        <Button size="sm" type="submit">
          <Plus className="h-4 w-4" />
          Register
        </Button>
      </form>
    </div>
  );
}

function WarrantsTab({
  detail,
  penalCode,
  reload,
  onChange,
}: {
  detail: CivilianDetail;
  penalCode: PenalCharge[];
  reload: () => void;
  onChange: () => void;
}) {
  const [reason, setReason] = useState("");
  const [charges, setCharges] = useState<string[]>([]);

  async function warrantAction(id: string, body: Record<string, unknown>) {
    await fetch(`/api/cad/warrants/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    reload();
    onChange();
  }

  return (
    <div className="space-y-3">
      {detail.warrants.length === 0 ? (
        <p className="text-sm text-[var(--cmd-fg-muted)]">No warrants on file.</p>
      ) : (
        <ul className="space-y-2">
          {detail.warrants.map((w) => (
            <li
              key={w.id}
              className="rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {w.warrantNumber ? (
                    <span className="font-[family-name:var(--cmd-font-mono)] text-[11px] text-[var(--cmd-fg-muted)]">
                      {w.warrantNumber}
                    </span>
                  ) : null}
                  <span className="text-sm font-medium">{w.reason}</span>
                </div>
                <Badge tone={warrantTone(w.state)}>{w.state}</Badge>
              </div>
              {w.charges.length > 0 ? (
                <p className="mt-1 text-xs text-[var(--cmd-fg-muted)]">{w.charges.join(", ")}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {w.state === "SUBMITTED" || w.state === "UNDER_REVIEW" ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void warrantAction(w.id, { action: "review", decision: "approve" })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void warrantAction(w.id, { action: "review", decision: "deny" })
                      }
                    >
                      Deny
                    </Button>
                  </>
                ) : null}
                {w.state === "APPROVED" ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void warrantAction(w.id, { action: "activate" })}
                  >
                    Activate
                  </Button>
                ) : null}
                {w.state === "ACTIVE" ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void warrantAction(w.id, { action: "serve" })}
                    >
                      Serve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void warrantAction(w.id, { action: "recall" })}
                    >
                      Recall
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <form
        className="space-y-2 rounded-[var(--cmd-radius)] border border-dashed border-[var(--cmd-border)] p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!reason.trim()) return;
          await fetch("/api/cad/warrants", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ civilianId: detail.id, reason, charges }),
          });
          setReason("");
          setCharges([]);
          reload();
          onChange();
        }}
      >
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Warrant reason"
          className="h-9 px-3 text-sm"
        />
        <ChargePicker penalCode={penalCode} charges={charges} setCharges={setCharges} />
        <Button size="sm" type="submit" variant="danger">
          <ShieldAlert className="h-4 w-4" />
          Submit warrant for review
        </Button>
      </form>
    </div>
  );
}

function RecordsTab({
  detail,
  penalCode,
  reload,
  onChange,
}: {
  detail: CivilianDetail;
  penalCode: PenalCharge[];
  reload: () => void;
  onChange: () => void;
}) {
  const [type, setType] = useState<RecordType>("CITATION");
  const [title, setTitle] = useState("");
  const [fine, setFine] = useState("");
  const [narrative, setNarrative] = useState("");
  const [charges, setCharges] = useState<string[]>([]);

  async function recordAction(id: string, body: Record<string, unknown>) {
    await fetch(`/api/cad/records/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    reload();
    onChange();
  }

  return (
    <div className="space-y-3">
      {detail.records.length === 0 ? (
        <p className="text-sm text-[var(--cmd-fg-muted)]">No records on file.</p>
      ) : (
        <ul className="space-y-2">
          {detail.records.map((r) => (
            <li
              key={r.id}
              className="rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {r.recordNumber ? (
                    <span className="font-[family-name:var(--cmd-font-mono)] text-[11px] text-[var(--cmd-fg-muted)]">
                      {r.recordNumber}
                    </span>
                  ) : null}
                  <span className="text-sm font-medium">{r.title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge tone="neutral">{r.type}</Badge>
                  <Badge tone={recordTone(r.status)}>{r.status}</Badge>
                </div>
              </div>
              {r.charges.length > 0 ? (
                <p className="mt-1 text-xs text-[var(--cmd-fg-muted)]">{r.charges.join(", ")}</p>
              ) : null}
              {r.fineAmount ? (
                <p className="text-xs text-[var(--cmd-fg-muted)]">Fine: ${r.fineAmount}</p>
              ) : null}
              {r.narrative ? <p className="mt-1 text-xs">{r.narrative}</p> : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.status === "DRAFT" || r.status === "REVISION_REQUESTED" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void recordAction(r.id, { action: "submit" })}
                  >
                    Submit
                  </Button>
                ) : null}
                {r.status === "SUBMITTED" || r.status === "UNDER_REVIEW" ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void recordAction(r.id, { action: "review", decision: "approve" })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void recordAction(r.id, { action: "review", decision: "reject" })
                      }
                    >
                      Reject
                    </Button>
                  </>
                ) : null}
                {r.status === "APPROVED" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void recordAction(r.id, { action: "lock" })}
                  >
                    Lock
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <form
        className="space-y-2 rounded-[var(--cmd-radius)] border border-dashed border-[var(--cmd-border)] p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          await fetch("/api/cad/records", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              civilianId: detail.id,
              type,
              title,
              charges,
              fineAmount: fine ? Number(fine) : undefined,
              narrative: narrative || undefined,
            }),
          });
          setTitle("");
          setFine("");
          setNarrative("");
          setCharges([]);
          reload();
          onChange();
        }}
      >
        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as RecordType)}
            className="h-9 rounded-[var(--cmd-radius-pill)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-3 text-sm"
          >
            {RECORD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="h-9 flex-1 px-3 text-sm"
          />
          <Input
            value={fine}
            onChange={(e) => setFine(e.target.value)}
            placeholder="Fine $"
            className="h-9 w-24 px-3 text-sm"
            inputMode="numeric"
          />
        </div>
        <ChargePicker penalCode={penalCode} charges={charges} setCharges={setCharges} />
        <Input
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          placeholder="Narrative (optional)"
          className="h-9 px-3 text-sm"
        />
        <Button size="sm" type="submit">
          <Scale className="h-4 w-4" />
          Save {type.toLowerCase()} draft
        </Button>
      </form>
    </div>
  );
}
