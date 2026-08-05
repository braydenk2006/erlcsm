export const CAD_CALL_STATUSES = ["PENDING", "DISPATCHED", "ACTIVE", "CLOSED"] as const;

export type CadCallStatus = (typeof CAD_CALL_STATUSES)[number];

const CALL_TRANSITIONS: Record<CadCallStatus, CadCallStatus[]> = {
  PENDING: ["DISPATCHED", "ACTIVE", "CLOSED"],
  DISPATCHED: ["ACTIVE", "PENDING", "CLOSED"],
  ACTIVE: ["DISPATCHED", "CLOSED"],
  CLOSED: ["PENDING"], // reopen
};

export function canTransitionCall(from: CadCallStatus, to: CadCallStatus): boolean {
  if (from === to) return true;
  return CALL_TRANSITIONS[from].includes(to);
}

export type CallTimestamps = {
  openedAt: Date;
  dispatchedAt?: Date | null;
  enRouteAt?: Date | null;
  onSceneAt?: Date | null;
  clearedAt?: Date | null;
};

export type ResponseTimes = {
  timeToDispatchMs: number | null;
  timeToEnRouteMs: number | null;
  timeToOnSceneMs: number | null;
  timeToClearMs: number | null;
  totalMs: number | null;
};

function diff(a: Date | null | undefined, b: Date | null | undefined): number | null {
  if (!a || !b) return null;
  const ms = b.getTime() - a.getTime();
  return ms >= 0 ? ms : null;
}

/** Compute response-time metrics from a call's lifecycle timestamps. */
export function responseTimes(ts: CallTimestamps): ResponseTimes {
  return {
    timeToDispatchMs: diff(ts.openedAt, ts.dispatchedAt),
    timeToEnRouteMs: diff(ts.openedAt, ts.enRouteAt),
    timeToOnSceneMs: diff(ts.openedAt, ts.onSceneAt),
    timeToClearMs: diff(ts.openedAt, ts.clearedAt),
    totalMs: diff(ts.openedAt, ts.clearedAt),
  };
}
