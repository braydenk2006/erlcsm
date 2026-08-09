"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Label, Skeleton, cn } from "@commandry/ui";

type Role = { id: string; key: string; name: string };
type Member = {
  membershipId: string;
  name: string;
  email: string;
  status: string;
  title: string | null;
  roles: Role[];
  departments: { id: string; name: string; isLeader: boolean }[];
};
type Invitation = {
  id: string;
  email: string;
  roleKey: string;
  status: string;
  invitedByName: string;
  expiresAt: string;
};
type Department = { id: string; name: string };

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: unknown }).error;
    throw new Error(
      typeof err === "string" ? err : ((err as { message?: string })?.message ?? "Request failed"),
    );
  }
  return json;
}

export function MembersView() {
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (status) params.set("status", status);
      const [m, d, inv] = await Promise.all([
        api(`/api/members?${params.toString()}`),
        api(`/api/departments`),
        api(`/api/invitations`),
      ]);
      setMembers(m.members);
      setRoles(m.roles);
      setDepartments(d.departments);
      setInvitations(inv.invitations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };

  if (loading && members.length === 0) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">Community</p>
          <h1 className="font-[family-name:var(--cmd-font-display)] text-2xl">Members</h1>
        </div>
      </header>

      {error ? (
        <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-danger)]/40 bg-[var(--cmd-danger)]/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-success)]/40 bg-[var(--cmd-success)]/10 px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <InvitePanel
        roles={roles}
        onInvited={(text) => {
          flash(text);
          void load();
        }}
      />

      <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="member-search">Search</Label>
            <Input
              id="member-search"
              placeholder="Search by name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="member-status">Status</Label>
            <select
              id="member-status"
              className="h-10 rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="FORMER">Former</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {members.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--cmd-fg-muted)]">
              No members match your filters.
            </p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                <tr className="border-b border-[var(--cmd-border)]">
                  <th className="py-2 pr-4">Member</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Roles</th>
                  <th className="px-2 py-2">Departments</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <MemberRow
                    key={m.membershipId}
                    member={m}
                    roles={roles}
                    departments={departments}
                    expanded={expanded === m.membershipId}
                    onToggle={() =>
                      setExpanded(expanded === m.membershipId ? null : m.membershipId)
                    }
                    onChanged={(text) => {
                      flash(text);
                      void load();
                    }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <InvitationsPanel
        invitations={invitations}
        onChanged={(text) => {
          flash(text);
          void load();
        }}
      />
    </div>
  );
}

function InvitePanel({ roles, onInvited }: { roles: Role[]; onInvited: (text: string) => void }) {
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState("member");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await api(`/api/invitations`, {
        method: "POST",
        body: JSON.stringify({ email, roleKey }),
      });
      setEmail("");
      const token = (res as { token?: string }).token;
      setLink(token ? `${window.location.origin}/invite/${token}` : null);
      onInvited("Invitation created.");
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to invite");
    } finally {
      setBusy(false);
    }
  };

  const roleOptions = roles.length > 0 ? roles : [{ id: "member", key: "member", name: "Member" }];

  return (
    <form onSubmit={submit} className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
      <h2 className="font-medium">Invite a member</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            required
            placeholder="person@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            className="h-10 rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-3 text-sm"
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
          >
            {roleOptions.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Inviting…" : "Send invite"}
        </Button>
      </div>
      {err ? <p className="mt-2 text-sm text-[var(--cmd-danger)]">{err}</p> : null}
      {link ? (
        <p className="mt-2 break-all text-xs text-[var(--cmd-fg-muted)]">
          Share this invite link: <span className="text-[var(--cmd-fg)]">{link}</span>
        </p>
      ) : null}
    </form>
  );
}

function MemberRow({
  member,
  roles,
  departments,
  expanded,
  onToggle,
  onChanged,
}: {
  member: Member;
  roles: Role[];
  departments: Department[];
  expanded: boolean;
  onToggle: () => void;
  onChanged: (text: string) => void;
}) {
  const [deptIds, setDeptIds] = useState(member.departments.map((d) => d.id));
  const [roleIds, setRoleIds] = useState(member.roles.map((r) => r.id));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/members/${member.membershipId}`, {
        method: "PATCH",
        body: JSON.stringify({ departmentIds: deptIds, roleIds }),
      });
      onChanged("Member updated.");
    } catch (error) {
      onChanged(error instanceof Error ? error.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: "ACTIVE" | "SUSPENDED") => {
    await api(`/api/members/${member.membershipId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    })
      .then(() => onChanged(`Member ${status === "ACTIVE" ? "reactivated" : "suspended"}.`))
      .catch((e) => onChanged(e instanceof Error ? e.message : "Failed"));
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${member.name} from the organization?`)) return;
    await api(`/api/members/${member.membershipId}`, { method: "DELETE" })
      .then(() => onChanged("Member removed."))
      .catch((e) => onChanged(e instanceof Error ? e.message : "Failed"));
  };

  return (
    <>
      <tr className="border-b border-[var(--cmd-border)]/50">
        <td className="py-3 pr-4">
          <p className="font-medium">{member.name}</p>
          <p className="text-xs text-[var(--cmd-fg-muted)]">{member.email}</p>
        </td>
        <td className="px-2 py-3">
          <Badge
            tone={
              member.status === "ACTIVE"
                ? "success"
                : member.status === "SUSPENDED"
                  ? "warning"
                  : "neutral"
            }
          >
            {member.status.toLowerCase()}
          </Badge>
        </td>
        <td className="px-2 py-3 text-xs text-[var(--cmd-fg-muted)]">
          {member.roles.map((r) => r.name).join(", ") || "—"}
        </td>
        <td className="px-2 py-3 text-xs text-[var(--cmd-fg-muted)]">
          {member.departments.map((d) => d.name).join(", ") || "—"}
        </td>
        <td className="px-2 py-3 text-right">
          <Button size="sm" variant="outline" onClick={onToggle}>
            {expanded ? "Close" : "Manage"}
          </Button>
        </td>
      </tr>
      {expanded ? (
        <tr>
          <td colSpan={5} className="bg-[var(--cmd-bg-muted)]/40 px-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-[var(--cmd-fg-muted)]">
                  Departments
                </p>
                <div className="flex flex-wrap gap-2">
                  {departments.length === 0 ? (
                    <span className="text-xs text-[var(--cmd-fg-muted)]">No departments yet.</span>
                  ) : (
                    departments.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() =>
                          setDeptIds((prev) =>
                            prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id],
                          )
                        }
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs",
                          deptIds.includes(d.id)
                            ? "border-[var(--cmd-accent)] text-[var(--cmd-accent)]"
                            : "border-[var(--cmd-border)] text-[var(--cmd-fg-muted)]",
                        )}
                      >
                        {d.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-[var(--cmd-fg-muted)]">
                  Roles
                </p>
                <div className="flex flex-wrap gap-2">
                  {roles.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() =>
                        setRoleIds((prev) =>
                          prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs",
                        roleIds.includes(r.id)
                          ? "border-[var(--cmd-accent)] text-[var(--cmd-accent)]"
                          : "border-[var(--cmd-border)] text-[var(--cmd-fg-muted)]",
                      )}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save assignments"}
              </Button>
              {member.status === "ACTIVE" ? (
                <Button size="sm" variant="outline" onClick={() => setStatus("SUSPENDED")}>
                  Suspend
                </Button>
              ) : member.status === "SUSPENDED" ? (
                <Button size="sm" variant="outline" onClick={() => setStatus("ACTIVE")}>
                  Reactivate
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={remove}>
                Remove
              </Button>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function InvitationsPanel({
  invitations,
  onChanged,
}: {
  invitations: Invitation[];
  onChanged: (text: string) => void;
}) {
  const pending = invitations.filter((i) => i.status === "PENDING");
  const resend = async (id: string) => {
    await api(`/api/invitations/${id}`, { method: "POST" })
      .then(() => onChanged("Invitation resent."))
      .catch((e) => onChanged(e instanceof Error ? e.message : "Failed"));
  };
  const revoke = async (id: string) => {
    await api(`/api/invitations/${id}`, { method: "DELETE" })
      .then(() => onChanged("Invitation revoked."))
      .catch((e) => onChanged(e instanceof Error ? e.message : "Failed"));
  };

  return (
    <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
      <h2 className="font-medium">Pending invitations</h2>
      {pending.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--cmd-fg-muted)]">No pending invitations.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--cmd-border)]/50">
          {pending.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="text-sm">{i.email}</p>
                <p className="text-xs text-[var(--cmd-fg-muted)]">
                  {i.roleKey} · invited by {i.invitedByName}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => resend(i.id)}>
                  Resend
                </Button>
                <Button size="sm" variant="ghost" onClick={() => revoke(i.id)}>
                  Revoke
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
