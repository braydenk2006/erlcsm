import { prisma } from "@commandry/database";
import { createPublicId } from "@commandry/shared";

// ---------------------------------------------------------------------------
// Enums (mirrors of the Prisma enums, kept as string unions for the API layer)
// ---------------------------------------------------------------------------

export type CadUnitType = "POLICE" | "SHERIFF" | "STATE" | "FIRE" | "EMS" | "DISPATCH";
export type CadUnitStatus =
  "AVAILABLE" | "BUSY" | "EN_ROUTE" | "ON_SCENE" | "PANIC" | "OUT_OF_SERVICE";
export type CadCallStatus = "PENDING" | "DISPATCHED" | "ACTIVE" | "CLOSED";
export type CadLicenseStatus = "VALID" | "SUSPENDED" | "REVOKED" | "EXPIRED" | "NONE";
export type CadRegistrationStatus = "VALID" | "EXPIRED" | "SUSPENDED" | "NONE";
export type CadWarrantStatus = "ACTIVE" | "CLEARED" | "EXPIRED";
export type CadRecordType = "CITATION" | "ARREST" | "INCIDENT" | "WARNING";
export type CadBoloType = "PERSON" | "VEHICLE";
export type CadBoloStatus = "ACTIVE" | "CLEARED";

// ---------------------------------------------------------------------------
// View types (JSON-friendly shapes returned to the web layer)
// ---------------------------------------------------------------------------

export type UnitView = {
  id: string;
  callsign: string;
  name: string;
  type: CadUnitType;
  status: CadUnitStatus;
  robloxUsername: string | null;
  onDutyAt: Date;
  lastStatusAt: Date;
  assignedCall: { id: string; title: string } | null;
};

export type CallSummaryView = {
  id: string;
  number: string;
  title: string;
  type: string | null;
  caller: string;
  message: string;
  location: string | null;
  postal: string | null;
  priority: number;
  status: CadCallStatus;
  source: string;
  openedAt: Date;
  unitCount: number;
  units: string[];
};

export type CallLogView = { id: string; author: string; note: string; createdAt: Date };

export type CallDetailView = CallSummaryView & {
  assignedUnits: { id: string; callsign: string; name: string; status: CadUnitStatus }[];
  logs: CallLogView[];
};

export type CivilianSummaryView = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  licenseStatus: CadLicenseStatus;
  robloxUsername: string | null;
  flags: string[];
  warrantCount: number;
};

export type VehicleView = {
  id: string;
  plate: string;
  model: string;
  color: string | null;
  registration: CadRegistrationStatus;
  insurance: CadRegistrationStatus;
  stolen: boolean;
  owner: { id: string; name: string } | null;
};

export type WarrantView = {
  id: string;
  status: CadWarrantStatus;
  charges: string[];
  reason: string;
  issuedBy: string | null;
  createdAt: Date;
  civilian: { id: string; name: string } | null;
};

export type RecordView = {
  id: string;
  type: CadRecordType;
  title: string;
  charges: string[];
  officerName: string | null;
  fineAmount: number | null;
  narrative: string | null;
  createdAt: Date;
  civilian: { id: string; name: string } | null;
};

export type BoloView = {
  id: string;
  type: CadBoloType;
  title: string;
  description: string;
  plate: string | null;
  status: CadBoloStatus;
  createdBy: string | null;
  createdAt: Date;
};

export type CivilianDetailView = CivilianSummaryView & {
  gender: string | null;
  address: string | null;
  phone: string | null;
  notes: string | null;
  vehicles: VehicleView[];
  warrants: WarrantView[];
  records: RecordView[];
};

export type CadSummary = {
  unitsOnDuty: number;
  activeCalls: number;
  activeWarrants: number;
  activeBolos: number;
  civilians: number;
  vehicles: number;
};

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export async function goOnDuty(
  organizationId: string,
  input: {
    callsign: string;
    name: string;
    type?: CadUnitType;
    userId?: string | null;
    robloxUsername?: string | null;
  },
): Promise<UnitView> {
  const unit = await prisma.cadUnit.create({
    data: {
      publicId: createPublicId("unit"),
      organizationId,
      callsign: input.callsign,
      name: input.name,
      type: input.type ?? "POLICE",
      userId: input.userId ?? null,
      robloxUsername: input.robloxUsername ?? null,
    },
  });
  return {
    id: unit.publicId,
    callsign: unit.callsign,
    name: unit.name,
    type: unit.type as CadUnitType,
    status: unit.status as CadUnitStatus,
    robloxUsername: unit.robloxUsername,
    onDutyAt: unit.onDutyAt,
    lastStatusAt: unit.lastStatusAt,
    assignedCall: null,
  };
}

export async function listUnits(organizationId: string): Promise<UnitView[]> {
  const units = await prisma.cadUnit.findMany({
    where: { organizationId },
    orderBy: { onDutyAt: "asc" },
    include: {
      callAssignments: {
        include: { call: { select: { publicId: true, title: true, status: true } } },
      },
    },
  });
  return units.map((unit) => {
    const active = unit.callAssignments.find((a) => a.call.status !== "CLOSED");
    return {
      id: unit.publicId,
      callsign: unit.callsign,
      name: unit.name,
      type: unit.type as CadUnitType,
      status: unit.status as CadUnitStatus,
      robloxUsername: unit.robloxUsername,
      onDutyAt: unit.onDutyAt,
      lastStatusAt: unit.lastStatusAt,
      assignedCall: active
        ? { id: active.call.publicId, title: active.call.title ?? "Call" }
        : null,
    };
  });
}

export async function setUnitStatus(
  organizationId: string,
  unitPublicId: string,
  status: CadUnitStatus,
): Promise<void> {
  await prisma.cadUnit.updateMany({
    where: { organizationId, publicId: unitPublicId },
    data: { status, lastStatusAt: new Date() },
  });
}

export async function goOffDuty(organizationId: string, unitPublicId: string): Promise<void> {
  await prisma.cadUnit.deleteMany({ where: { organizationId, publicId: unitPublicId } });
}

// ---------------------------------------------------------------------------
// Calls (dispatch)
// ---------------------------------------------------------------------------

async function resolveUnitId(organizationId: string, unitPublicId: string): Promise<string | null> {
  const unit = await prisma.cadUnit.findFirst({
    where: { organizationId, publicId: unitPublicId },
    select: { id: true },
  });
  return unit?.id ?? null;
}

async function resolveCallId(organizationId: string, callPublicId: string): Promise<string | null> {
  const call = await prisma.cadCall.findFirst({
    where: { organizationId, publicId: callPublicId },
    select: { id: true },
  });
  return call?.id ?? null;
}

export async function createCall(
  organizationId: string,
  input: {
    title: string;
    type?: string;
    caller?: string;
    message: string;
    location?: string;
    postal?: string;
    priority?: number;
    createdByUserId?: string | null;
  },
): Promise<CallSummaryView> {
  const call = await prisma.cadCall.create({
    data: {
      publicId: createPublicId("call"),
      organizationId,
      source: "manual",
      externalId: createPublicId("callext"),
      number: "911",
      title: input.title,
      type: input.type ?? null,
      caller: input.caller ?? "Dispatch",
      message: input.message,
      location: input.location ?? null,
      postal: input.postal ?? null,
      priority: input.priority ?? 3,
      status: "PENDING",
      createdByUserId: input.createdByUserId ?? null,
    },
  });
  return {
    id: call.publicId,
    number: call.number,
    title: call.title ?? input.title,
    type: call.type,
    caller: call.caller,
    message: call.message,
    location: call.location,
    postal: call.postal,
    priority: call.priority,
    status: call.status as CadCallStatus,
    source: call.source,
    openedAt: call.openedAt,
    unitCount: 0,
    units: [],
  };
}

export async function listCalls(
  organizationId: string,
  options: { includeClosed?: boolean } = {},
): Promise<CallSummaryView[]> {
  const calls = await prisma.cadCall.findMany({
    where: {
      organizationId,
      ...(options.includeClosed ? {} : { status: { not: "CLOSED" } }),
    },
    orderBy: [{ priority: "asc" }, { openedAt: "desc" }],
    take: 100,
    include: { units: { include: { unit: { select: { callsign: true } } } } },
  });
  return calls.map((call) => ({
    id: call.publicId,
    number: call.number,
    title: call.title ?? call.message.slice(0, 40),
    type: call.type,
    caller: call.caller,
    message: call.message,
    location: call.location,
    postal: call.postal,
    priority: call.priority,
    status: call.status as CadCallStatus,
    source: call.source,
    openedAt: call.openedAt,
    unitCount: call.units.length,
    units: call.units.map((u) => u.unit.callsign),
  }));
}

export async function getCall(
  organizationId: string,
  callPublicId: string,
): Promise<CallDetailView | null> {
  const call = await prisma.cadCall.findFirst({
    where: { organizationId, publicId: callPublicId },
    include: {
      units: { include: { unit: true } },
      logs: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!call) return null;
  return {
    id: call.publicId,
    number: call.number,
    title: call.title ?? call.message.slice(0, 40),
    type: call.type,
    caller: call.caller,
    message: call.message,
    location: call.location,
    postal: call.postal,
    priority: call.priority,
    status: call.status as CadCallStatus,
    source: call.source,
    openedAt: call.openedAt,
    unitCount: call.units.length,
    units: call.units.map((u) => u.unit.callsign),
    assignedUnits: call.units.map((u) => ({
      id: u.unit.publicId,
      callsign: u.unit.callsign,
      name: u.unit.name,
      status: u.unit.status as CadUnitStatus,
    })),
    logs: call.logs.map((logEntry) => ({
      id: logEntry.id,
      author: logEntry.authorName ?? "System",
      note: logEntry.note,
      createdAt: logEntry.createdAt,
    })),
  };
}

export async function assignUnitToCall(
  organizationId: string,
  callPublicId: string,
  unitPublicId: string,
): Promise<void> {
  const callId = await resolveCallId(organizationId, callPublicId);
  const unitId = await resolveUnitId(organizationId, unitPublicId);
  if (!callId || !unitId) return;

  await prisma.cadCallUnit.upsert({
    where: { callId_unitId: { callId, unitId } },
    create: { callId, unitId },
    update: {},
  });
  await prisma.cadUnit.update({ where: { id: unitId }, data: { status: "EN_ROUTE" } });
  await prisma.cadCall.update({
    where: { id: callId },
    data: { status: "DISPATCHED" },
  });
  const unit = await prisma.cadUnit.findUnique({
    where: { id: unitId },
    select: { callsign: true },
  });
  await prisma.cadCallLog.create({
    data: { callId, authorName: "Dispatch", note: `Unit ${unit?.callsign ?? ""} assigned` },
  });
}

export async function unassignUnitFromCall(
  organizationId: string,
  callPublicId: string,
  unitPublicId: string,
): Promise<void> {
  const callId = await resolveCallId(organizationId, callPublicId);
  const unitId = await resolveUnitId(organizationId, unitPublicId);
  if (!callId || !unitId) return;
  await prisma.cadCallUnit.deleteMany({ where: { callId, unitId } });
  await prisma.cadUnit.update({ where: { id: unitId }, data: { status: "AVAILABLE" } });
}

export async function addCallLog(
  organizationId: string,
  callPublicId: string,
  note: string,
  authorName: string,
): Promise<void> {
  const callId = await resolveCallId(organizationId, callPublicId);
  if (!callId) return;
  await prisma.cadCallLog.create({ data: { callId, authorName, note } });
}

export async function updateCallStatus(
  organizationId: string,
  callPublicId: string,
  status: CadCallStatus,
): Promise<void> {
  await prisma.cadCall.updateMany({
    where: { organizationId, publicId: callPublicId },
    data: { status, ...(status === "CLOSED" ? { closedAt: new Date() } : {}) },
  });
}

export async function closeCall(organizationId: string, callPublicId: string): Promise<void> {
  const callId = await resolveCallId(organizationId, callPublicId);
  if (!callId) return;
  const assignments = await prisma.cadCallUnit.findMany({
    where: { callId },
    select: { unitId: true },
  });
  await prisma.cadUnit.updateMany({
    where: { id: { in: assignments.map((a) => a.unitId) } },
    data: { status: "AVAILABLE" },
  });
  await prisma.cadCallUnit.deleteMany({ where: { callId } });
  await prisma.cadCall.update({
    where: { id: callId },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  await prisma.cadCallLog.create({ data: { callId, authorName: "Dispatch", note: "Call closed" } });
}

// ---------------------------------------------------------------------------
// Civilians
// ---------------------------------------------------------------------------

function civilianName(c: { firstName: string; lastName: string }): string {
  return `${c.firstName} ${c.lastName}`;
}

export async function createCivilian(
  organizationId: string,
  input: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string | null;
    gender?: string | null;
    address?: string | null;
    phone?: string | null;
    licenseStatus?: CadLicenseStatus;
    robloxUsername?: string | null;
    createdByUserId?: string | null;
  },
): Promise<CivilianSummaryView> {
  const civilian = await prisma.cadCivilian.create({
    data: {
      publicId: createPublicId("civ"),
      organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      gender: input.gender ?? null,
      address: input.address ?? null,
      phone: input.phone ?? null,
      licenseStatus: input.licenseStatus ?? "VALID",
      robloxUsername: input.robloxUsername ?? null,
      createdByUserId: input.createdByUserId ?? null,
    },
  });
  return {
    id: civilian.publicId,
    firstName: civilian.firstName,
    lastName: civilian.lastName,
    dateOfBirth: civilian.dateOfBirth,
    licenseStatus: civilian.licenseStatus as CadLicenseStatus,
    robloxUsername: civilian.robloxUsername,
    flags: civilian.flags,
    warrantCount: 0,
  };
}

export async function listCivilians(
  organizationId: string,
  search?: string,
): Promise<CivilianSummaryView[]> {
  const civilians = await prisma.cadCivilian.findMany({
    where: {
      organizationId,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { robloxUsername: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { lastName: "asc" },
    take: 100,
    include: { _count: { select: { warrants: { where: { status: "ACTIVE" } } } } },
  });
  return civilians.map((civilian) => ({
    id: civilian.publicId,
    firstName: civilian.firstName,
    lastName: civilian.lastName,
    dateOfBirth: civilian.dateOfBirth,
    licenseStatus: civilian.licenseStatus as CadLicenseStatus,
    robloxUsername: civilian.robloxUsername,
    flags: civilian.flags,
    warrantCount: civilian._count.warrants,
  }));
}

function mapVehicle(vehicle: {
  publicId: string;
  plate: string;
  model: string;
  color: string | null;
  registration: string;
  insurance: string;
  stolen: boolean;
  owner: { publicId: string; firstName: string; lastName: string } | null;
}): VehicleView {
  return {
    id: vehicle.publicId,
    plate: vehicle.plate,
    model: vehicle.model,
    color: vehicle.color,
    registration: vehicle.registration as CadRegistrationStatus,
    insurance: vehicle.insurance as CadRegistrationStatus,
    stolen: vehicle.stolen,
    owner: vehicle.owner ? { id: vehicle.owner.publicId, name: civilianName(vehicle.owner) } : null,
  };
}

function mapWarrant(warrant: {
  publicId: string;
  status: string;
  charges: string[];
  reason: string;
  issuedByName: string | null;
  createdAt: Date;
  civilian: { publicId: string; firstName: string; lastName: string } | null;
}): WarrantView {
  return {
    id: warrant.publicId,
    status: warrant.status as CadWarrantStatus,
    charges: warrant.charges,
    reason: warrant.reason,
    issuedBy: warrant.issuedByName,
    createdAt: warrant.createdAt,
    civilian: warrant.civilian
      ? { id: warrant.civilian.publicId, name: civilianName(warrant.civilian) }
      : null,
  };
}

function mapRecord(record: {
  publicId: string;
  type: string;
  title: string;
  charges: string[];
  officerName: string | null;
  fineAmount: number | null;
  narrative: string | null;
  createdAt: Date;
  civilian: { publicId: string; firstName: string; lastName: string } | null;
}): RecordView {
  return {
    id: record.publicId,
    type: record.type as CadRecordType,
    title: record.title,
    charges: record.charges,
    officerName: record.officerName,
    fineAmount: record.fineAmount,
    narrative: record.narrative,
    createdAt: record.createdAt,
    civilian: record.civilian
      ? { id: record.civilian.publicId, name: civilianName(record.civilian) }
      : null,
  };
}

export async function getCivilian(
  organizationId: string,
  civilianPublicId: string,
): Promise<CivilianDetailView | null> {
  const civilian = await prisma.cadCivilian.findFirst({
    where: { organizationId, publicId: civilianPublicId },
    include: {
      vehicles: { include: { owner: true } },
      warrants: { orderBy: { createdAt: "desc" }, include: { civilian: true } },
      records: { orderBy: { createdAt: "desc" }, include: { civilian: true } },
    },
  });
  if (!civilian) return null;
  const activeWarrants = civilian.warrants.filter((w) => w.status === "ACTIVE").length;
  return {
    id: civilian.publicId,
    firstName: civilian.firstName,
    lastName: civilian.lastName,
    dateOfBirth: civilian.dateOfBirth,
    licenseStatus: civilian.licenseStatus as CadLicenseStatus,
    robloxUsername: civilian.robloxUsername,
    flags: civilian.flags,
    warrantCount: activeWarrants,
    gender: civilian.gender,
    address: civilian.address,
    phone: civilian.phone,
    notes: civilian.notes,
    vehicles: civilian.vehicles.map(mapVehicle),
    warrants: civilian.warrants.map(mapWarrant),
    records: civilian.records.map(mapRecord),
  };
}

export async function updateCivilian(
  organizationId: string,
  civilianPublicId: string,
  data: { licenseStatus?: CadLicenseStatus; flags?: string[]; notes?: string | null },
): Promise<void> {
  await prisma.cadCivilian.updateMany({
    where: { organizationId, publicId: civilianPublicId },
    data: {
      ...(data.licenseStatus ? { licenseStatus: data.licenseStatus } : {}),
      ...(data.flags ? { flags: data.flags } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export async function createVehicle(
  organizationId: string,
  input: {
    plate: string;
    model: string;
    color?: string | null;
    ownerCivilianId?: string | null;
    registration?: CadRegistrationStatus;
    insurance?: CadRegistrationStatus;
    stolen?: boolean;
    notes?: string | null;
  },
): Promise<VehicleView> {
  let ownerId: string | null = null;
  if (input.ownerCivilianId) {
    const owner = await prisma.cadCivilian.findFirst({
      where: { organizationId, publicId: input.ownerCivilianId },
      select: { id: true },
    });
    ownerId = owner?.id ?? null;
  }
  const vehicle = await prisma.cadVehicle.create({
    data: {
      publicId: createPublicId("veh"),
      organizationId,
      plate: input.plate.toUpperCase(),
      model: input.model,
      color: input.color ?? null,
      ownerId,
      registration: input.registration ?? "VALID",
      insurance: input.insurance ?? "VALID",
      stolen: input.stolen ?? false,
      notes: input.notes ?? null,
    },
    include: { owner: true },
  });
  return mapVehicle(vehicle);
}

export async function listVehicles(
  organizationId: string,
  search?: string,
): Promise<VehicleView[]> {
  const vehicles = await prisma.cadVehicle.findMany({
    where: {
      organizationId,
      ...(search
        ? {
            OR: [
              { plate: { contains: search.toUpperCase() } },
              { model: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { owner: true },
  });
  return vehicles.map(mapVehicle);
}

export async function setVehicleStolen(
  organizationId: string,
  vehiclePublicId: string,
  stolen: boolean,
): Promise<void> {
  await prisma.cadVehicle.updateMany({
    where: { organizationId, publicId: vehiclePublicId },
    data: { stolen },
  });
}

// ---------------------------------------------------------------------------
// Warrants
// ---------------------------------------------------------------------------

export async function createWarrant(
  organizationId: string,
  input: {
    civilianId: string;
    charges: string[];
    reason: string;
    issuedByName?: string | null;
    issuedByUserId?: string | null;
  },
): Promise<WarrantView | null> {
  const civilian = await prisma.cadCivilian.findFirst({
    where: { organizationId, publicId: input.civilianId },
    select: { id: true },
  });
  if (!civilian) return null;
  const warrant = await prisma.cadWarrant.create({
    data: {
      publicId: createPublicId("wrt"),
      organizationId,
      civilianId: civilian.id,
      charges: input.charges,
      reason: input.reason,
      issuedByName: input.issuedByName ?? null,
      issuedByUserId: input.issuedByUserId ?? null,
    },
    include: { civilian: true },
  });
  return mapWarrant(warrant);
}

export async function listWarrants(
  organizationId: string,
  status?: CadWarrantStatus,
): Promise<WarrantView[]> {
  const warrants = await prisma.cadWarrant.findMany({
    where: { organizationId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { civilian: true },
  });
  return warrants.map(mapWarrant);
}

export async function clearWarrant(organizationId: string, warrantPublicId: string): Promise<void> {
  await prisma.cadWarrant.updateMany({
    where: { organizationId, publicId: warrantPublicId },
    data: { status: "CLEARED", clearedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Records (citations / arrests / incidents / warnings)
// ---------------------------------------------------------------------------

export async function createRecord(
  organizationId: string,
  input: {
    civilianId?: string | null;
    type: CadRecordType;
    title: string;
    charges?: string[];
    officerName?: string | null;
    officerUserId?: string | null;
    fineAmount?: number | null;
    narrative?: string | null;
  },
): Promise<RecordView> {
  let civilianId: string | null = null;
  if (input.civilianId) {
    const civilian = await prisma.cadCivilian.findFirst({
      where: { organizationId, publicId: input.civilianId },
      select: { id: true },
    });
    civilianId = civilian?.id ?? null;
  }
  const record = await prisma.cadRecord.create({
    data: {
      publicId: createPublicId("rec"),
      organizationId,
      civilianId,
      type: input.type,
      title: input.title,
      charges: input.charges ?? [],
      officerName: input.officerName ?? null,
      officerUserId: input.officerUserId ?? null,
      fineAmount: input.fineAmount ?? null,
      narrative: input.narrative ?? null,
    },
    include: { civilian: true },
  });
  return mapRecord(record);
}

export async function listRecords(
  organizationId: string,
  options: { type?: CadRecordType } = {},
): Promise<RecordView[]> {
  const records = await prisma.cadRecord.findMany({
    where: { organizationId, ...(options.type ? { type: options.type } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { civilian: true },
  });
  return records.map(mapRecord);
}

// ---------------------------------------------------------------------------
// BOLOs
// ---------------------------------------------------------------------------

export async function createBolo(
  organizationId: string,
  input: {
    type: CadBoloType;
    title: string;
    description: string;
    plate?: string | null;
    createdByName?: string | null;
    createdByUserId?: string | null;
  },
): Promise<BoloView> {
  const bolo = await prisma.cadBolo.create({
    data: {
      publicId: createPublicId("bolo"),
      organizationId,
      type: input.type,
      title: input.title,
      description: input.description,
      plate: input.plate ?? null,
      createdByName: input.createdByName ?? null,
      createdByUserId: input.createdByUserId ?? null,
    },
  });
  return {
    id: bolo.publicId,
    type: bolo.type as CadBoloType,
    title: bolo.title,
    description: bolo.description,
    plate: bolo.plate,
    status: bolo.status as CadBoloStatus,
    createdBy: bolo.createdByName,
    createdAt: bolo.createdAt,
  };
}

export async function listBolos(
  organizationId: string,
  status?: CadBoloStatus,
): Promise<BoloView[]> {
  const bolos = await prisma.cadBolo.findMany({
    where: { organizationId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return bolos.map((bolo) => ({
    id: bolo.publicId,
    type: bolo.type as CadBoloType,
    title: bolo.title,
    description: bolo.description,
    plate: bolo.plate,
    status: bolo.status as CadBoloStatus,
    createdBy: bolo.createdByName,
    createdAt: bolo.createdAt,
  }));
}

export async function clearBolo(organizationId: string, boloPublicId: string): Promise<void> {
  await prisma.cadBolo.updateMany({
    where: { organizationId, publicId: boloPublicId },
    data: { status: "CLEARED" },
  });
}

// ---------------------------------------------------------------------------
// Dashboard summary
// ---------------------------------------------------------------------------

export async function getCadSummary(organizationId: string): Promise<CadSummary> {
  const [unitsOnDuty, activeCalls, activeWarrants, activeBolos, civilians, vehicles] =
    await Promise.all([
      prisma.cadUnit.count({ where: { organizationId } }),
      prisma.cadCall.count({ where: { organizationId, status: { not: "CLOSED" } } }),
      prisma.cadWarrant.count({ where: { organizationId, status: "ACTIVE" } }),
      prisma.cadBolo.count({ where: { organizationId, status: "ACTIVE" } }),
      prisma.cadCivilian.count({ where: { organizationId } }),
      prisma.cadVehicle.count({ where: { organizationId } }),
    ]);
  return { unitsOnDuty, activeCalls, activeWarrants, activeBolos, civilians, vehicles };
}
