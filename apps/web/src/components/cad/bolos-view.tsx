"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Plus } from "lucide-react";
import { Badge, Button, Input } from "@commandry/ui";
import type { Bolo, BoloType } from "./types";

export function BolosView({ onChange }: { onChange: () => void }) {
  const [bolos, setBolos] = useState<Bolo[]>([]);
  const [type, setType] = useState<BoloType>("PERSON");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [plate, setPlate] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/cad/bolos?status=ACTIVE", { cache: "no-store" });
    const json = await res.json();
    setBolos(json.bolos ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function clear(id: string) {
    await fetch(`/api/cad/bolos/${id}`, { method: "PATCH" });
    await load();
    onChange();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Eye className="h-4 w-4 text-[var(--cmd-accent)]" />
          <h3 className="font-semibold">Active BOLOs</h3>
          <Badge tone="neutral">{bolos.length}</Badge>
        </div>
        {bolos.length === 0 ? (
          <p className="text-sm text-[var(--cmd-fg-muted)]">No active BOLOs.</p>
        ) : (
          <ul className="space-y-2">
            {bolos.map((b) => (
              <li
                key={b.id}
                className="rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="accent">{b.type}</Badge>
                    <span className="text-sm font-medium">{b.title}</span>
                    {b.plate ? <Badge tone="warning">{b.plate}</Badge> : null}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void clear(b.id)}>
                    Clear
                  </Button>
                </div>
                <p className="mt-1 text-xs text-[var(--cmd-fg-muted)]">{b.description}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="cmd-glass h-max rounded-[var(--cmd-radius-xl)] p-4">
        <h3 className="mb-3 font-semibold">New BOLO</h3>
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim() || !description.trim()) return;
            await fetch("/api/cad/bolos", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ type, title, description, plate: plate || undefined }),
            });
            setTitle("");
            setDescription("");
            setPlate("");
            await load();
            onChange();
          }}
        >
          <select
            value={type}
            onChange={(e) => setType(e.target.value as BoloType)}
            className="h-9 w-full rounded-[var(--cmd-radius-pill)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-3 text-sm"
          >
            <option value="PERSON">Person</option>
            <option value="VEHICLE">Vehicle</option>
          </select>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="h-9 px-3 text-sm"
          />
          {type === "VEHICLE" ? (
            <Input
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="Plate (optional)"
              className="h-9 px-3 text-sm"
            />
          ) : null}
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="h-9 px-3 text-sm"
          />
          <Button size="sm" type="submit" className="w-full">
            <Plus className="h-4 w-4" />
            Issue BOLO
          </Button>
        </form>
      </div>
    </div>
  );
}
