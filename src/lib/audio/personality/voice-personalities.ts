import type { CommercialAgentGender } from "@/lib/agents/personality/commercial-agents";

import {
  AFRICAN_VOICE_PROFILES,
  type AfricanVoiceProfile,
  type AfricanVoiceProfileId,
} from "./african-voice-profiles";

export type AgentVoicePersonality = {
  personaKey: string;
  displayName: string;
  profileId: AfricanVoiceProfileId;
  profile: AfricanVoiceProfile;
  rhythm: "fast" | "balanced" | "calm";
  description: string;
};

const PERSONA_MAP: Record<string, Omit<AgentVoicePersonality, "profile" | "profileId">> = {
  bryan: {
    personaKey: "bryan",
    displayName: "Bryan",
    rhythm: "fast",
    description: "Rapide, vendeur, dynamique — phrases courtes.",
  },
  grace: {
    personaKey: "grace",
    displayName: "Grace",
    rhythm: "calm",
    description: "Calme, rassurante, premium — ton posé.",
  },
  vanessa: {
    personaKey: "vanessa",
    displayName: "Vanessa",
    rhythm: "calm",
    description: "Douce, relation client, élégante.",
  },
  cynthia: {
    personaKey: "cynthia",
    displayName: "Cynthia",
    rhythm: "calm",
    description: "Premium, professionnelle, claire.",
  },
  brice: {
    personaKey: "brice",
    displayName: "Brice",
    rhythm: "balanced",
    description: "Direct, chaleureux, structuré.",
  },
  kevin: {
    personaKey: "kevin",
    displayName: "Kevin",
    rhythm: "fast",
    description: "Concret, efficace, rythme soutenu.",
  },
  jordan: {
    personaKey: "jordan",
    displayName: "Jordan",
    rhythm: "balanced",
    description: "Conversationnel pro, mobile.",
  },
  naomi: {
    personaKey: "naomi",
    displayName: "Naomi",
    rhythm: "balanced",
    description: "Naturelle, accueillante.",
  },
};

function profileForPersona(personaKey: string, gender?: CommercialAgentGender): AfricanVoiceProfileId {
  const k = personaKey.toLowerCase();
  if (k === "bryan" || k === "brice" || k === "kevin" || k === "jordan") {
    return gender === "female" ? "african_female_young_commercial" : "african_male_young_commercial";
  }
  if (k === "grace" || k === "cynthia" || k === "vanessa" || k === "naomi") {
    return k === "grace" || k === "cynthia" ? "african_female_calm_premium" : "african_female_young_commercial";
  }
  return gender === "female" ? "african_female_young_commercial" : "african_male_warm_advisor";
}

export function resolveAgentVoicePersonality(args: {
  personaKey?: string | null;
  gender?: CommercialAgentGender;
}): AgentVoicePersonality {
  const key = String(args.personaKey ?? "default").toLowerCase();
  const base = PERSONA_MAP[key] ?? {
    personaKey: key,
    displayName: "Conseiller",
    rhythm: "balanced" as const,
    description: "Ton commercial naturel Afrique francophone.",
  };
  const profileId = profileForPersona(key, args.gender);
  const profile = AFRICAN_VOICE_PROFILES[profileId];
  return { ...base, profileId, profile };
}
