export type PlanId = "free" | "pro";

export type ProFeature =
  | "modes_all"
  | "responses_3"
  | "advanced_memory"
  | "full_history"
  | "premium_tones"
  | "faster_generation"
  | "priority_support";

export const PLAN_LIMITS = {
  free: {
    monthlyGenerations: 100,
    allowedModes: ["reply", "promo"] as const,
    responseFormats: ["single"] as const,
    historyDays: 3,
    memoryLevel: "limited" as const,
  },
  pro: {
    monthlyGenerations: 2000,
    allowedModes: ["reply", "followup", "closing", "complaint", "promo", "business_chat"] as const,
    responseFormats: ["single", "items_3"] as const,
    historyDays: 3650, // effectively "full"
    memoryLevel: "advanced" as const,
  },
} as const;

export function hasProFeature(plan: PlanId, feature: ProFeature) {
  if (plan === "pro") return true;
  return false;
}

export function isModeAllowed(plan: PlanId, mode: string) {
  const allowed = PLAN_LIMITS[plan].allowedModes as readonly string[];
  return allowed.includes(mode);
}

export function isResponseFormatAllowed(plan: PlanId, responseFormat: string) {
  const allowed = PLAN_LIMITS[plan].responseFormats as readonly string[];
  return allowed.includes(responseFormat);
}
