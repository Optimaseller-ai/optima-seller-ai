/**
 * Mémoire automation — Supabase + cache mémoire (fallback dev).
 */

import "server-only";

import { createAdminClientSafe } from "@/lib/supabase/admin";
import type { AutomationActionChannel } from "./cooldown-engine";

export type AutomationHistoryStatus = "executed" | "blocked" | "skipped";

export type AutomationHistoryRow = {
  id: string;
  prospectId: string;
  conversationId: string;
  agentId?: string;
  sessionId?: string;
  actionType: string;
  actionChannel: AutomationActionChannel;
  executedAt: string;
  cooldownUntil: string;
  status: AutomationHistoryStatus;
  metadata?: Record<string, unknown>;
};

type MemoryEntry = AutomationHistoryRow;

const memoryStore: MemoryEntry[] = [];
const MAX_MEMORY = 2000;

function pruneMemory() {
  if (memoryStore.length <= MAX_MEMORY) return;
  memoryStore.splice(0, memoryStore.length - MAX_MEMORY);
}

function rowFromDb(r: Record<string, unknown>): AutomationHistoryRow {
  return {
    id: String(r.id),
    prospectId: String(r.prospect_id),
    conversationId: String(r.conversation_id),
    agentId: r.agent_id ? String(r.agent_id) : undefined,
    sessionId: r.session_id ? String(r.session_id) : undefined,
    actionType: String(r.action_type),
    actionChannel: String(r.action_channel) as AutomationActionChannel,
    executedAt: String(r.executed_at),
    cooldownUntil: String(r.cooldown_until),
    status: (String(r.status) as AutomationHistoryStatus) || "executed",
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  };
}

export async function insertAutomationHistory(entry: Omit<AutomationHistoryRow, "id">): Promise<AutomationHistoryRow> {
  const row: AutomationHistoryRow = {
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    ...entry,
  };

  memoryStore.push(row);
  pruneMemory();

  const admin = createAdminClientSafe();
  if (!admin) return row;

  try {
    const { data, error } = await admin
      .from("automation_action_history")
      .insert({
        prospect_id: entry.prospectId,
        conversation_id: entry.conversationId,
        agent_id: entry.agentId ?? null,
        session_id: entry.sessionId ?? null,
        action_type: entry.actionType,
        action_channel: entry.actionChannel,
        executed_at: entry.executedAt,
        cooldown_until: entry.cooldownUntil,
        status: entry.status,
        metadata: entry.metadata ?? {},
      })
      .select("id,prospect_id,conversation_id,agent_id,session_id,action_type,action_channel,executed_at,cooldown_until,status,metadata")
      .single();

    if (!error && data) return rowFromDb(data as Record<string, unknown>);
  } catch {
    /* table absente — cache mémoire uniquement */
  }

  return row;
}

export async function findRecentAutomationHistory(args: {
  conversationId: string;
  actionType?: string;
  actionChannel?: AutomationActionChannel;
  workflowSlug?: string;
  sinceIso?: string;
  limit?: number;
}): Promise<AutomationHistoryRow[]> {
  const limit = args.limit ?? 20;
  const sinceMs = args.sinceIso ? Date.parse(args.sinceIso) : 0;

  const fromMemory = memoryStore
    .filter((r) => {
      if (r.conversationId !== args.conversationId) return false;
      if (args.actionType && r.actionType !== args.actionType) return false;
      if (args.actionChannel && r.actionChannel !== args.actionChannel) return false;
      if (sinceMs && Date.parse(r.executedAt) < sinceMs) return false;
      if (args.workflowSlug) {
        const slug = String(r.metadata?.workflowSlug ?? "");
        if (slug && slug !== args.workflowSlug) return false;
      }
      return true;
    })
    .sort((a, b) => Date.parse(b.executedAt) - Date.parse(a.executedAt))
    .slice(0, limit);

  const admin = createAdminClientSafe();
  if (!admin) return fromMemory;

  try {
    let q = admin
      .from("automation_action_history")
      .select(
        "id,prospect_id,conversation_id,agent_id,session_id,action_type,action_channel,executed_at,cooldown_until,status,metadata",
      )
      .eq("conversation_id", args.conversationId)
      .order("executed_at", { ascending: false })
      .limit(limit);

    if (args.actionType) q = q.eq("action_type", args.actionType);
    if (args.actionChannel) q = q.eq("action_channel", args.actionChannel);
    if (args.sinceIso) q = q.gte("executed_at", args.sinceIso);

    const { data, error } = await q;
    if (error || !data?.length) return fromMemory;
    return (data as Record<string, unknown>[]).map(rowFromDb);
  } catch {
    return fromMemory;
  }
}

export async function getActiveCooldownForConversation(
  conversationId: string,
): Promise<AutomationHistoryRow | null> {
  const now = new Date().toISOString();

  const mem = memoryStore
    .filter((r) => r.conversationId === conversationId && r.cooldownUntil > now && r.status === "executed")
    .sort((a, b) => Date.parse(b.cooldownUntil) - Date.parse(a.cooldownUntil))[0];
  if (mem) return mem;

  const admin = createAdminClientSafe();
  if (!admin) return mem ?? null;

  try {
    const { data } = await admin
      .from("automation_action_history")
      .select(
        "id,prospect_id,conversation_id,agent_id,session_id,action_type,action_channel,executed_at,cooldown_until,status,metadata",
      )
      .eq("conversation_id", conversationId)
      .gt("cooldown_until", now)
      .eq("status", "executed")
      .order("cooldown_until", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) return rowFromDb(data as Record<string, unknown>);
  } catch {
    /* ignore */
  }

  return mem ?? null;
}

export type SupervisionHistoryInsight = {
  conversationId: string;
  sessionId?: string;
  prospectName?: string;
  lastActionType?: string;
  lastActionChannel?: string;
  lastExecutedAt?: string;
  cooldownUntil?: string;
  blockedReason?: string;
  humanLabel: string;
};

const recentBlocks: Array<{
  at: string;
  conversationId: string;
  sessionId?: string;
  reason: string;
  actionType: string;
  cooldownUntil?: string;
}> = [];

export function logBlockedAutomationForSupervision(args: {
  conversationId: string;
  sessionId?: string;
  reason: string;
  actionType: string;
  cooldownUntil?: string;
}) {
  recentBlocks.unshift({
    at: new Date().toISOString(),
    ...args,
  });
  if (recentBlocks.length > 80) recentBlocks.length = 80;
}

export function getRecentBlockedForSupervision(limit = 12): typeof recentBlocks {
  return recentBlocks.slice(0, limit);
}

export async function buildSupervisionHistoryInsights(
  sessionIds: string[],
  prospectNames: Map<string, string>,
): Promise<SupervisionHistoryInsight[]> {
  const out: SupervisionHistoryInsight[] = [];
  const now = Date.now();

  for (const block of getRecentBlockedForSupervision(8)) {
    const remaining = block.cooldownUntil ? Date.parse(block.cooldownUntil) - now : 0;
    const untilLabel = block.cooldownUntil
      ? new Date(block.cooldownUntil).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      : undefined;
    out.push({
      conversationId: block.conversationId,
      sessionId: block.sessionId,
      blockedReason: block.reason,
      cooldownUntil: block.cooldownUntil,
      humanLabel:
        remaining > 0 && untilLabel
          ? `Action bloquée anti-spam — cooldown jusqu'à ${untilLabel}`
          : "Action bloquée pour éviter le spam",
    });
  }

  for (const sessionId of sessionIds.slice(0, 6)) {
    const convId = sessionId.startsWith("optima_conv_") ? sessionId : `optima_conv_unknown_${sessionId}`;
    const active = await getActiveCooldownForConversation(convId);
    if (!active) continue;
    const ago = formatRelativeFr(Date.parse(active.executedAt));
    const until = new Date(active.cooldownUntil).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    out.push({
      conversationId: active.conversationId,
      sessionId: active.sessionId,
      prospectName: prospectNames.get(sessionId),
      lastActionType: active.actionType,
      lastActionChannel: active.actionChannel,
      lastExecutedAt: active.executedAt,
      cooldownUntil: active.cooldownUntil,
      humanLabel: `Dernière relance envoyée ${ago} — cooldown actif jusqu'à ${until}`,
    });
  }

  return out.slice(0, 10);
}

function formatRelativeFr(atMs: number): string {
  const diff = Date.now() - atMs;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}
