import type { SmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";

const PREFIX = "optima_prechat_v1_";

export function preChatStorageKey(slug: string) {
  return `${PREFIX}${slug.trim().toLowerCase()}`;
}

export function readPreChatProfile(slug: string): SmartProspectProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(preChatStorageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SmartProspectProfile;
    const hasContact = Boolean(parsed?.email?.trim() || parsed?.phone?.trim());
    if (!parsed?.name?.trim() || !hasContact) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePreChatProfile(slug: string, profile: SmartProspectProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(preChatStorageKey(slug), JSON.stringify(profile));
  } catch {
    // quota
  }
}

export function isPreChatComplete(slug: string): boolean {
  return readPreChatProfile(slug) != null;
}
