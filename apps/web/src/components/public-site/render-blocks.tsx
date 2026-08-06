import type { ResolvedBlock } from "@commandry/api";

/** Public block renderer — turns resolved blocks (with live Ordinex data) into a
 * themed public page. Styling uses the site's CSS variables (--site-*). */

function cfg(b: ResolvedBlock, key: string, fallback = ""): string {
  const v = b.config[key];
  return typeof v === "string" ? v : fallback;
}

const card =
  "rounded-[var(--site-radius)] border border-[var(--site-border)] bg-[var(--site-surface)] p-5";
const title = (t?: string) =>
  t ? (
    <h2 className="mb-4 font-[family-name:var(--site-font-heading)] text-2xl font-semibold">{t}</h2>
  ) : null;

function Hero({ b }: { b: ResolvedBlock }) {
  return (
    <section className="rounded-[var(--site-radius)] bg-[linear-gradient(135deg,var(--site-primary),var(--site-secondary))] px-8 py-16 text-center text-white">
      <h1 className="font-[family-name:var(--site-font-heading)] text-4xl font-bold md:text-5xl">
        {cfg(b, "heading")}
      </h1>
      {cfg(b, "subheading") ? (
        <p className="mx-auto mt-3 max-w-2xl text-white/90">{cfg(b, "subheading")}</p>
      ) : null}
      {cfg(b, "ctaLabel") ? (
        <a
          href={cfg(b, "ctaHref", "#")}
          className="mt-6 inline-block rounded-full bg-white/95 px-6 py-2.5 font-semibold text-black"
        >
          {cfg(b, "ctaLabel")}
        </a>
      ) : null}
    </section>
  );
}

function Stats({ b }: { b: ResolvedBlock }) {
  const stats = (b.data as { label: string; value: string }[]) ?? [];
  if (stats.length === 0) return null;
  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className={`${card} text-center`}>
          <p className="text-3xl font-bold text-[var(--site-accent)]">{s.value}</p>
          <p className="mt-1 text-sm text-[var(--site-muted)]">{s.label}</p>
        </div>
      ))}
    </section>
  );
}

function News({ b }: { b: ResolvedBlock }) {
  const items =
    (b.data as { title: string; body: string; author: string; publishedAt: string | null }[]) ?? [];
  return (
    <section>
      {title(cfg(b, "title", "News"))}
      {items.length === 0 ? (
        <p className="text-sm text-[var(--site-muted)]">No announcements yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((n, i) => (
            <article key={i} className={card}>
              <h3 className="font-semibold">{n.title}</h3>
              <p className="mt-1 text-sm text-[var(--site-muted)]">{n.body}</p>
              <p className="mt-2 text-xs text-[var(--site-muted)]">By {n.author}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Staff({ b }: { b: ResolvedBlock }) {
  const members =
    (b.data as {
      name: string;
      title: string | null;
      roles: string[];
      departments: string[];
      avatarUrl: string | null;
    }[]) ?? [];
  return (
    <section>
      {title(cfg(b, "title", "Staff"))}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {members.map((m, i) => (
          <div key={i} className={`${card} text-center`}>
            {m.avatarUrl ? (
              <img
                src={m.avatarUrl}
                alt=""
                className="mx-auto h-16 w-16 rounded-full border border-[var(--site-border)]"
              />
            ) : (
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--site-primary)] text-lg font-semibold text-white">
                {m.name.slice(0, 1)}
              </div>
            )}
            <p className="mt-2 font-medium">{m.name}</p>
            <p className="text-xs text-[var(--site-muted)]">{m.title ?? m.roles[0] ?? "Member"}</p>
            {m.departments.length ? (
              <p className="text-xs text-[var(--site-muted)]">{m.departments.join(", ")}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function Departments({ b }: { b: ResolvedBlock }) {
  const depts =
    (b.data as {
      name: string;
      description: string | null;
      accentColor: string | null;
      memberCount: number;
    }[]) ?? [];
  return (
    <section>
      {title(cfg(b, "title", "Departments"))}
      <div className="grid gap-4 md:grid-cols-3">
        {depts.map((d, i) => (
          <div key={i} className={card}>
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: d.accentColor ?? "var(--site-accent)" }}
              />
              <h3 className="font-semibold">{d.name}</h3>
            </div>
            {d.description ? (
              <p className="mt-1 text-sm text-[var(--site-muted)]">{d.description}</p>
            ) : null}
            <p className="mt-2 text-xs text-[var(--site-muted)]">{d.memberCount} members</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Upcoming({ b }: { b: ResolvedBlock }) {
  const items = (b.data as { title: string; start?: string; scheduledFor?: string | null }[]) ?? [];
  return (
    <section>
      {title(cfg(b, "title", "Upcoming"))}
      {items.length === 0 ? (
        <p className="text-sm text-[var(--site-muted)]">Nothing scheduled right now.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((s, i) => {
            const when = s.start ?? s.scheduledFor ?? null;
            return (
              <li key={i} className={`${card} flex items-center justify-between`}>
                <span className="font-medium">{s.title}</span>
                <span className="text-sm text-[var(--site-muted)]">
                  {when ? new Date(when).toLocaleString() : "TBD"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Applications({ b }: { b: ResolvedBlock }) {
  const items = (b.data as { name: string; description: string | null }[]) ?? [];
  return (
    <section>
      {title(cfg(b, "title", "Applications"))}
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((a, i) => (
          <div key={i} className={card}>
            <h3 className="font-semibold">{a.name}</h3>
            <p className="mt-1 text-sm text-[var(--site-muted)]">{a.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ServerStatus({ b }: { b: ResolvedBlock }) {
  const d = b.data as {
    enabled: boolean;
    online?: boolean;
    name?: string;
    currentPlayers?: number;
    maxPlayers?: number;
  } | null;
  if (!d?.enabled) return null;
  return (
    <section className={`${card} flex flex-wrap items-center justify-between gap-3`}>
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-full ${d.online ? "bg-green-500" : "bg-red-500"}`} />
        <span className="font-medium">{d.name ?? "Server"}</span>
        <span className="text-sm text-[var(--site-muted)]">{d.online ? "Online" : "Offline"}</span>
      </div>
      {d.online ? (
        <span className="text-sm text-[var(--site-muted)]">
          {d.currentPlayers ?? 0} / {d.maxPlayers ?? 0} players
        </span>
      ) : null}
    </section>
  );
}

function Text({ b }: { b: ResolvedBlock }) {
  return (
    <section className={card}>
      {cfg(b, "heading") ? (
        <h2 className="font-[family-name:var(--site-font-heading)] text-2xl font-semibold">
          {cfg(b, "heading")}
        </h2>
      ) : null}
      {cfg(b, "body") ? <p className="mt-2 text-[var(--site-muted)]">{cfg(b, "body")}</p> : null}
    </section>
  );
}

function Cta({ b }: { b: ResolvedBlock }) {
  return (
    <section className="rounded-[var(--site-radius)] bg-[var(--site-primary)] px-8 py-10 text-center text-white">
      <h2 className="text-2xl font-semibold">{cfg(b, "heading", "Get started")}</h2>
      {cfg(b, "ctaLabel") ? (
        <a
          href={cfg(b, "ctaHref", "#")}
          className="mt-4 inline-block rounded-full bg-white px-6 py-2.5 font-semibold text-black"
        >
          {cfg(b, "ctaLabel")}
        </a>
      ) : null}
    </section>
  );
}

function Contact({ b }: { b: ResolvedBlock }) {
  return (
    <section className={card}>
      {title(cfg(b, "title", "Contact us"))}
      <p className="text-sm text-[var(--site-muted)]">
        Reach the team through your community&apos;s Discord or by submitting a request in the
        workspace.
      </p>
    </section>
  );
}

export function RenderBlocks({ blocks }: { blocks: ResolvedBlock[] }) {
  return (
    <div className="space-y-10">
      {blocks.map((b) => {
        switch (b.type) {
          case "hero":
            return <Hero key={b.id} b={b} />;
          case "stats":
            return <Stats key={b.id} b={b} />;
          case "announcements":
          case "latest_news":
            return <News key={b.id} b={b} />;
          case "staff_directory":
            return <Staff key={b.id} b={b} />;
          case "department_list":
          case "department_spotlight":
            return <Departments key={b.id} b={b} />;
          case "upcoming_patrols":
          case "upcoming_sessions":
          case "calendar":
            return <Upcoming key={b.id} b={b} />;
          case "application_list":
            return <Applications key={b.id} b={b} />;
          case "server_status":
          case "player_count":
            return <ServerStatus key={b.id} b={b} />;
          case "text":
            return <Text key={b.id} b={b} />;
          case "cta":
            return <Cta key={b.id} b={b} />;
          case "contact_form":
            return <Contact key={b.id} b={b} />;
          case "divider":
            return <hr key={b.id} className="border-[var(--site-border)]" />;
          case "spacer":
            return <div key={b.id} className="h-8" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
