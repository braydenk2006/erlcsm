"use client";

import { useCallback, useEffect, useState } from "react";
import { Car, Plus, Search } from "lucide-react";
import { Badge, Button, Input } from "@commandry/ui";
import type { Vehicle } from "./types";

export function VehiclesView({ onChange }: { onChange: () => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [query, setQuery] = useState("");
  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");

  const search = useCallback(async (q: string) => {
    const res = await fetch(`/api/cad/vehicles?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    const json = await res.json();
    setVehicles(json.vehicles ?? []);
  }, []);

  useEffect(() => {
    void search("");
  }, [search]);

  async function toggleStolen(v: Vehicle) {
    await fetch(`/api/cad/vehicles/${v.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stolen: !v.stolen }),
    });
    await search(query);
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
        <h3 className="mb-3 font-semibold">Register / lookup a vehicle</h3>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!plate.trim() || !model.trim()) return;
            await fetch("/api/cad/vehicles", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ plate, model, color: color || undefined }),
            });
            setPlate("");
            setModel("");
            setColor("");
            await search("");
            onChange();
          }}
        >
          <Input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="Plate"
            className="h-9 w-32 px-3 text-sm"
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
            className="h-9 w-28 px-3 text-sm"
          />
          <Button size="sm" type="submit">
            <Plus className="h-4 w-4" />
            Register
          </Button>
        </form>
      </div>

      <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cmd-fg-muted)]" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              void search(e.target.value);
            }}
            placeholder="Search by plate or model"
            className="h-9 pl-9 text-sm"
          />
        </div>
        {vehicles.length === 0 ? (
          <p className="text-sm text-[var(--cmd-fg-muted)]">No vehicles registered.</p>
        ) : (
          <ul className="space-y-2">
            {vehicles.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] p-3"
              >
                <div className="flex items-center gap-3">
                  <Car className="h-4 w-4 text-[var(--cmd-accent)]" />
                  <div>
                    <p className="text-sm font-medium">
                      {v.plate} · {v.model}
                      {v.color ? ` (${v.color})` : ""}
                    </p>
                    <p className="text-xs text-[var(--cmd-fg-muted)]">
                      Owner: {v.owner?.name ?? "Unregistered"} · Reg {v.registration}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {v.stolen ? <Badge tone="danger">STOLEN</Badge> : null}
                  <Button
                    size="sm"
                    variant={v.stolen ? "outline" : "ghost"}
                    onClick={() => void toggleStolen(v)}
                  >
                    {v.stolen ? "Recover" : "Flag stolen"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
