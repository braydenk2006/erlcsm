import { recordAuditEvent } from "@commandry/audit";
import { prisma } from "@commandry/database";
import type { Actor } from "@commandry/permissions";
import { NotFoundError, ValidationError, createPublicId } from "@commandry/shared";
import { requirePlatformStaff } from "../staff/service";

/**
 * Customer support tickets. Reuses users/orgs/audit. Internal staff notes are
 * NEVER returned to customers — the customer read path filters `internal = true`.
 */
export const TICKET_CATEGORIES = [
  "general",
  "account",
  "billing",
  "discord",
  "roblox",
  "erlc",
  "cad_rms",
  "website",
  "automation",
  "ai",
  "bug",
  "feature",
  "security",
  "enterprise",
] as const;
export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"] as const;
export const TICKET_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "WAITING_ON_CUSTOMER",
  "WAITING_ON_ORDINEX",
  "ESCALATED",
  "RESOLVED",
  "CLOSED",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export type TicketView = {
  id: string;
  number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  assigneeUserId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type TicketMessageView = {
  id: string;
  authorType: string;
  internal: boolean;
  body: string;
  createdAt: string;
};

function ticketView(t: {
  id: string;
  number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  assigneeUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): TicketView {
  return {
    id: t.id,
    number: t.number,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status,
    assigneeUserId: t.assigneeUserId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Customer side
// ---------------------------------------------------------------------------

export async function createTicket(input: {
  actor: Actor;
  organizationId: string;
  subject: string;
  category: string;
  priority?: string;
  body: string;
}): Promise<TicketView> {
  if (input.subject.trim().length < 3) throw new ValidationError("Subject too short");
  if (input.body.trim().length < 3) throw new ValidationError("Please describe the issue");
  const category = (TICKET_CATEGORIES as readonly string[]).includes(input.category)
    ? input.category
    : "general";
  const priority = (TICKET_PRIORITIES as readonly string[]).includes(input.priority ?? "")
    ? input.priority!
    : "NORMAL";
  const count = await prisma.supportTicket.count({
    where: { organizationId: input.organizationId },
  });
  const number = `TKT-${String(count + 1).padStart(5, "0")}`;
  const ticket = await prisma.supportTicket.create({
    data: {
      publicId: createPublicId("tkt"),
      organizationId: input.organizationId,
      number,
      subject: input.subject.trim(),
      category,
      priority,
      requesterUserId: input.actor.userId,
    },
  });
  await prisma.supportTicketMessage.create({
    data: {
      organizationId: input.organizationId,
      ticketId: ticket.id,
      authorUserId: input.actor.userId,
      authorType: "customer",
      internal: false,
      body: input.body.trim(),
    },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "support.ticket.create",
    resourceType: "support_ticket",
    resourceId: ticket.id,
    source: "WEB",
    metadata: { category, priority },
  }).catch(() => undefined);
  return ticketView(ticket);
}

export async function listMyTickets(input: {
  actor: Actor;
  organizationId: string;
}): Promise<TicketView[]> {
  const rows = await prisma.supportTicket.findMany({
    where: { organizationId: input.organizationId, requesterUserId: input.actor.userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(ticketView);
}

/** Customer view of a ticket — internal staff notes are excluded. */
export async function getTicket(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<{ ticket: TicketView; messages: TicketMessageView[] }> {
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: input.id,
      organizationId: input.organizationId,
      requesterUserId: input.actor.userId,
    },
  });
  if (!ticket) throw new NotFoundError("Ticket not found");
  const messages = await prisma.supportTicketMessage.findMany({
    where: { ticketId: ticket.id, internal: false },
    orderBy: { createdAt: "asc" },
  });
  return {
    ticket: ticketView(ticket),
    messages: messages.map((m) => ({
      id: m.id,
      authorType: m.authorType,
      internal: m.internal,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function replyTicket(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  body: string;
}): Promise<void> {
  if (input.body.trim().length < 1) throw new ValidationError("Empty reply");
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: input.id,
      organizationId: input.organizationId,
      requesterUserId: input.actor.userId,
    },
  });
  if (!ticket) throw new NotFoundError("Ticket not found");
  if (ticket.status === "CLOSED") throw new ValidationError("This ticket is closed");
  await prisma.supportTicketMessage.create({
    data: {
      organizationId: input.organizationId,
      ticketId: ticket.id,
      authorUserId: input.actor.userId,
      authorType: "customer",
      internal: false,
      body: input.body.trim(),
    },
  });
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: "WAITING_ON_ORDINEX" },
  });
}

export async function submitSatisfaction(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  score: number;
}): Promise<void> {
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: input.id,
      organizationId: input.organizationId,
      requesterUserId: input.actor.userId,
    },
  });
  if (!ticket) throw new NotFoundError("Ticket not found");
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { satisfaction: Math.max(1, Math.min(5, input.score)) },
  });
}

// ---------------------------------------------------------------------------
// Staff side (platform staff only)
// ---------------------------------------------------------------------------

export type StaffTicketView = TicketView & { organizationName: string; requesterEmail: string };

export async function staffListTickets(input: {
  staffUserId: string;
  status?: string;
  assignedToMe?: boolean;
}): Promise<StaffTicketView[]> {
  await requirePlatformStaff(input.staffUserId);
  const rows = await prisma.supportTicket.findMany({
    where: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.assignedToMe ? { assigneeUserId: input.staffUserId } : {}),
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: 100,
    include: { organization: { select: { name: true } } },
  });
  const requesterIds = [...new Set(rows.map((r) => r.requesterUserId))];
  const users = await prisma.user.findMany({
    where: { id: { in: requesterIds } },
    select: { id: true, email: true },
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  return rows.map((t) => ({
    ...ticketView(t),
    organizationName: t.organization.name,
    requesterEmail: emailById.get(t.requesterUserId) ?? "",
  }));
}

export async function staffGetTicket(input: {
  staffUserId: string;
  id: string;
}): Promise<{ ticket: StaffTicketView; messages: TicketMessageView[] }> {
  await requirePlatformStaff(input.staffUserId);
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: input.id },
    include: { organization: { select: { name: true } } },
  });
  if (!ticket) throw new NotFoundError("Ticket not found");
  const requester = await prisma.user.findUnique({
    where: { id: ticket.requesterUserId },
    select: { email: true },
  });
  const messages = await prisma.supportTicketMessage.findMany({
    where: { ticketId: ticket.id },
    orderBy: { createdAt: "asc" },
  });
  return {
    ticket: {
      ...ticketView(ticket),
      organizationName: ticket.organization.name,
      requesterEmail: requester?.email ?? "",
    },
    messages: messages.map((m) => ({
      id: m.id,
      authorType: m.authorType,
      internal: m.internal,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function staffReply(input: {
  staffUserId: string;
  id: string;
  body: string;
  internal: boolean;
}): Promise<void> {
  await requirePlatformStaff(input.staffUserId);
  if (input.body.trim().length < 1) throw new ValidationError("Empty message");
  const ticket = await prisma.supportTicket.findUnique({ where: { id: input.id } });
  if (!ticket) throw new NotFoundError("Ticket not found");
  await prisma.supportTicketMessage.create({
    data: {
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
      authorUserId: input.staffUserId,
      authorType: "staff",
      internal: input.internal,
      body: input.body.trim(),
    },
  });
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      ...(ticket.firstResponseAt || input.internal ? {} : { firstResponseAt: new Date() }),
      ...(input.internal ? {} : { status: "WAITING_ON_CUSTOMER" }),
    },
  });
  await recordAuditEvent({
    organizationId: ticket.organizationId,
    actorUserId: input.staffUserId,
    action: input.internal ? "support.ticket.note" : "support.ticket.reply",
    resourceType: "support_ticket",
    resourceId: ticket.id,
    source: "PLATFORM_SUPPORT",
  }).catch(() => undefined);
}

export async function assignTicket(input: {
  staffUserId: string;
  id: string;
  assigneeUserId: string;
}): Promise<void> {
  await requirePlatformStaff(input.staffUserId);
  const assignee = await requirePlatformStaff(input.assigneeUserId).catch(() => null);
  if (!assignee) throw new ValidationError("Assignee must be platform staff");
  const ticket = await prisma.supportTicket.findUnique({ where: { id: input.id } });
  if (!ticket) throw new NotFoundError("Ticket not found");
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      assigneeUserId: input.assigneeUserId,
      status: ticket.status === "OPEN" ? "ASSIGNED" : ticket.status,
    },
  });
  await recordAuditEvent({
    organizationId: ticket.organizationId,
    actorUserId: input.staffUserId,
    action: "support.ticket.assign",
    resourceType: "support_ticket",
    resourceId: ticket.id,
    source: "PLATFORM_SUPPORT",
    metadata: { assigneeUserId: input.assigneeUserId },
  }).catch(() => undefined);
}

export async function setTicketStatus(input: {
  staffUserId: string;
  id: string;
  status: TicketStatus;
}): Promise<void> {
  await requirePlatformStaff(input.staffUserId);
  if (!(TICKET_STATUSES as readonly string[]).includes(input.status))
    throw new ValidationError("Invalid status");
  const ticket = await prisma.supportTicket.findUnique({ where: { id: input.id } });
  if (!ticket) throw new NotFoundError("Ticket not found");
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status: input.status,
      ...(input.status === "RESOLVED" ? { resolvedAt: new Date() } : {}),
      ...(input.status === "CLOSED" ? { closedAt: new Date() } : {}),
    },
  });
  await recordAuditEvent({
    organizationId: ticket.organizationId,
    actorUserId: input.staffUserId,
    action: "support.ticket.status",
    resourceType: "support_ticket",
    resourceId: ticket.id,
    source: "PLATFORM_SUPPORT",
    metadata: { status: input.status },
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Support macros (staff reusable templates)
// ---------------------------------------------------------------------------

export type MacroView = { id: string; name: string; category: string; body: string };

export async function listMacros(input: { staffUserId: string }): Promise<MacroView[]> {
  await requirePlatformStaff(input.staffUserId);
  const rows = await prisma.supportMacro.findMany({ orderBy: { name: "asc" }, take: 100 });
  return rows.map((m) => ({ id: m.id, name: m.name, category: m.category, body: m.body }));
}

export async function createMacro(input: {
  staffUserId: string;
  name: string;
  category?: string;
  body: string;
}): Promise<MacroView> {
  await requirePlatformStaff(input.staffUserId);
  if (input.name.trim().length < 2 || input.body.trim().length < 2)
    throw new ValidationError("Name and body are required");
  const m = await prisma.supportMacro.create({
    data: {
      publicId: createPublicId("mac"),
      name: input.name.trim(),
      category: input.category ?? "general",
      body: input.body.trim(),
      createdByUserId: input.staffUserId,
    },
  });
  return { id: m.id, name: m.name, category: m.category, body: m.body };
}
