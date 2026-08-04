export type PlanKey = "free" | "growth" | "pro" | "enterprise";

export type PlanLimits = {
  members: number;
  storageGb: number;
  aiCredits: number;
  automations: number;
  apiRequestsPerDay: number;
  cadEnabled: boolean;
  webhooksEnabled: boolean;
};

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: {
    members: 50,
    storageGb: 1,
    aiCredits: 25,
    automations: 3,
    apiRequestsPerDay: 1000,
    cadEnabled: false,
    webhooksEnabled: false,
  },
  growth: {
    members: 500,
    storageGb: 25,
    aiCredits: 500,
    automations: 50,
    apiRequestsPerDay: 20000,
    cadEnabled: false,
    webhooksEnabled: false,
  },
  pro: {
    members: 2000,
    storageGb: 100,
    aiCredits: 2000,
    automations: 200,
    apiRequestsPerDay: 100000,
    cadEnabled: true,
    webhooksEnabled: true,
  },
  enterprise: {
    members: 100000,
    storageGb: 1000,
    aiCredits: 100000,
    automations: 10000,
    apiRequestsPerDay: 1000000,
    cadEnabled: true,
    webhooksEnabled: true,
  },
};
