// Client-side view types for the CAD/MDT workspace. Timestamps arrive as ISO
// strings over JSON.

export type UnitType = "POLICE" | "SHERIFF" | "STATE" | "FIRE" | "EMS" | "DISPATCH";
export type UnitStatus =
  "AVAILABLE" | "BUSY" | "EN_ROUTE" | "ON_SCENE" | "PANIC" | "OUT_OF_SERVICE";
export type CallStatus = "PENDING" | "DISPATCHED" | "ACTIVE" | "CLOSED";
export type LicenseStatus = "VALID" | "SUSPENDED" | "REVOKED" | "EXPIRED" | "NONE";
export type RegistrationStatus = "VALID" | "EXPIRED" | "SUSPENDED" | "NONE";
export type WarrantStatus = "ACTIVE" | "CLEARED" | "EXPIRED";
export type RecordType = "CITATION" | "ARREST" | "INCIDENT" | "WARNING";
export type BoloType = "PERSON" | "VEHICLE";

export type Unit = {
  id: string;
  callsign: string;
  name: string;
  type: UnitType;
  status: UnitStatus;
  robloxUsername: string | null;
  assignedCall: { id: string; title: string } | null;
};

export type CallSummary = {
  id: string;
  number: string;
  callNumber: string | null;
  title: string;
  type: string | null;
  caller: string;
  message: string;
  location: string | null;
  postal: string | null;
  priority: number;
  status: CallStatus;
  source: string;
  openedAt: string;
  unitCount: number;
  units: string[];
};

export type CallDetail = CallSummary & {
  assignedUnits: { id: string; callsign: string; name: string; status: UnitStatus }[];
  logs: { id: string; author: string; note: string; createdAt: string }[];
};

export type Vehicle = {
  id: string;
  plate: string;
  model: string;
  color: string | null;
  registration: RegistrationStatus;
  insurance: RegistrationStatus;
  stolen: boolean;
  owner: { id: string; name: string } | null;
};

export type Warrant = {
  id: string;
  status: WarrantStatus;
  charges: string[];
  reason: string;
  issuedBy: string | null;
  createdAt: string;
  civilian: { id: string; name: string } | null;
};

export type CadRecord = {
  id: string;
  type: RecordType;
  title: string;
  charges: string[];
  officerName: string | null;
  fineAmount: number | null;
  narrative: string | null;
  createdAt: string;
  civilian: { id: string; name: string } | null;
};

export type Bolo = {
  id: string;
  type: BoloType;
  title: string;
  description: string;
  plate: string | null;
  status: "ACTIVE" | "CLEARED";
  createdBy: string | null;
  createdAt: string;
};

export type CivilianSummary = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  licenseStatus: LicenseStatus;
  robloxUsername: string | null;
  flags: string[];
  warrantCount: number;
};

export type CivilianDetail = CivilianSummary & {
  gender: string | null;
  address: string | null;
  phone: string | null;
  notes: string | null;
  vehicles: Vehicle[];
  warrants: Warrant[];
  records: CadRecord[];
};

export type CadSummary = {
  unitsOnDuty: number;
  activeCalls: number;
  activeWarrants: number;
  activeBolos: number;
  civilians: number;
  vehicles: number;
};

export type PenalCharge = {
  code: string;
  title: string;
  class: string;
  fine: number;
  jailMinutes: number;
};
