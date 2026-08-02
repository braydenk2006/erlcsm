"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@commandry/ui";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function CreateOrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-5 cmd-glass rounded-2xl p-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const response = await fetch("/api/organizations", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name,
              slug: slug || slugify(name),
              timezone,
              organizationType: "custom",
              approximateSize: "small",
            }),
          });
          const payload = (await response.json()) as { error?: string; slug?: string };
          if (!response.ok) {
            setError(payload.error ?? "Unable to create organization");
            return;
          }
          router.push("/app");
          router.refresh();
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Community name</Label>
        <Input
          id="name"
          name="name"
          required
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slug) setSlug(slugify(event.target.value));
          }}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          required
          value={slug}
          onChange={(event) => setSlug(slugify(event.target.value))}
          disabled={pending}
          aria-describedby="slug-help"
        />
        <p id="slug-help" className="text-xs text-[var(--cmd-fg-muted)]">
          Used for subdomain routing: {slug || "your-community"}.commandry.app
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="timezone">Time zone</Label>
        <Input
          id="timezone"
          name="timezone"
          required
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          disabled={pending}
        />
      </div>
      {error ? (
        <p className="text-sm text-[var(--cmd-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create organization"}
      </Button>
    </form>
  );
}
