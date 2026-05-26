/**
 * Store CRM prospect-core — mémoire hors chat UI (remplacer par DB plus tard).
 */

import "server-only";

import { buildIdempotencyKey } from "@/lib/automation/anti-duplicate";
import type { ProspectCoreProfile } from "./prospect-profile";
import { emptyProspectCoreProfile } from "./prospect-profile";

const BY_SESSION = new Map<string, ProspectCoreProfile>();
const MAX_STORE = 8000;

export function prospectCoreStoreKey(agentId: string, sessionId: string): string {
  return buildIdempotencyKey(["prospect_core", agentId, sessionId]);
}

export function getProspectCore(agentId: string, sessionId: string): ProspectCoreProfile | undefined {
  return BY_SESSION.get(prospectCoreStoreKey(agentId, sessionId));
}

export function upsertProspectCore(profile: ProspectCoreProfile): ProspectCoreProfile {
  const key = prospectCoreStoreKey(profile.agentId, profile.sessionId);
  BY_SESSION.set(key, profile);
  if (BY_SESSION.size > MAX_STORE) {
    const first = BY_SESSION.keys().next().value;
    if (first) BY_SESSION.delete(first);
  }
  return profile;
}

/**
 * 1 chat = 1 prospect — crée si absent (nouveau chat / nouvelle session).
 */
export function getOrCreateProspectCore(args: {
  agentId: string;
  sessionId: string;
  phone?: string | null;
  email?: string | null;
  name?: string;
  city?: string | null;
  country?: string | null;
}): ProspectCoreProfile {
  const existing = getProspectCore(args.agentId, args.sessionId);
  if (existing) {
    const merged: ProspectCoreProfile = {
      ...existing,
      phone: args.phone ?? existing.phone,
      email: args.email ?? existing.email,
      name: args.name?.trim() ? args.name.trim() : existing.name,
      city: args.city ?? existing.city,
      country: args.country ?? existing.country,
      updatedAt: Date.now(),
    };
    return upsertProspectCore(merged);
  }

  const base = emptyProspectCoreProfile({
    id: args.sessionId,
    sessionId: args.sessionId,
    agentId: args.agentId,
    name: args.name,
  });
  const created: ProspectCoreProfile = {
    ...base,
    phone: args.phone ?? null,
    email: args.email ?? null,
    city: args.city ?? null,
    country: args.country ?? null,
  };
  return upsertProspectCore(created);
}

export function linkProspectCoreByContact(args: {
  agentId: string;
  sessionId: string;
  phone?: string | null;
  email?: string | null;
}): ProspectCoreProfile {
  return getOrCreateProspectCore(args);
}
