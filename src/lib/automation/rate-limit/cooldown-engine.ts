/**
 * Cooldown engine — fenêtres anti-spam selon température prospect et canal.
 */

import "server-only";

export type AutomationActionChannel = "email" | "whatsapp" | "workflow" | "crm" | "chat" | "multi";

const H = 60 * 60 * 1000;

/** Règles métier (spec produit). */
const TEMPERATURE_DEFAULT_MS: Record<string, Partial<Record<AutomationActionChannel | "any", number>>> = {
  ready_to_buy: {
    email: 12 * H,
    whatsapp: 12 * H,
    workflow: 12 * H,
    any: 12 * H,
  },
  ready: {
    email: 12 * H,
    whatsapp: 12 * H,
    workflow: 12 * H,
    any: 12 * H,
  },
  hot: {
    email: 24 * H,
    whatsapp: 24 * H,
    workflow: 24 * H,
    chat: 6 * H,
    any: 24 * H,
  },
  warm: {
    email: 48 * H,
    whatsapp: 48 * H,
    workflow: 48 * H,
    any: 48 * H,
  },
  cold: {
    email: 72 * H,
    whatsapp: 72 * H,
    workflow: 72 * H,
    any: 72 * H,
  },
};

/** Cooldown minimum entre deux actions identiques (toutes températures). */
const SAME_ACTION_FLOOR_MS = 30 * 60 * 1000;

/** Même workflow n8n — anti boucle. */
const SAME_WORKFLOW_MS = 6 * H;

export function normalizeLeadTemperature(temp?: string | null): string {
  const t = String(temp ?? "warm").trim().toLowerCase();
  if (t === "ready_to_buy" || t === "ready") return "ready_to_buy";
  if (t === "hot") return "hot";
  if (t === "cold") return "cold";
  return "warm";
}

export function resolveCooldownMs(args: {
  leadTemperature?: string | null;
  actionChannel: AutomationActionChannel;
  actionType: string;
}): number {
  const temp = normalizeLeadTemperature(args.leadTemperature);
  const rules = TEMPERATURE_DEFAULT_MS[temp] ?? TEMPERATURE_DEFAULT_MS.warm!;
  const channelMs = rules[args.actionChannel] ?? rules.any ?? 48 * H;

  const type = args.actionType.toUpperCase();
  if (type.includes("EMAIL") || type.includes("PRODUCT_EMAIL")) {
    return Math.max(channelMs, rules.email ?? channelMs);
  }
  if (type.includes("WHATSAPP") || type.includes("FOLLOWUP")) {
    return Math.max(channelMs, rules.whatsapp ?? channelMs);
  }
  if (type.includes("HOT") || type.includes("ALERT") || type.includes("WORKFLOW")) {
    return Math.max(channelMs, rules.workflow ?? channelMs);
  }

  return Math.max(channelMs, SAME_ACTION_FLOOR_MS);
}

export function computeCooldownUntilIso(
  fromMs: number,
  cooldownMs: number,
): string {
  return new Date(fromMs + cooldownMs).toISOString();
}

export function remainingCooldownMs(cooldownUntilIso: string, now = Date.now()): number {
  const end = Date.parse(cooldownUntilIso);
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, end - now);
}

export function isWorkflowCooldownMs(): number {
  return SAME_WORKFLOW_MS;
}
