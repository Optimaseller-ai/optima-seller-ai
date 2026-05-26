import "server-only";

/**
 * Cohérence voix automate — les relances / templates tiers doivent réutiliser la même identité.
 * Prêt pour overrides DB par persona_key.
 */
export type AgentPersonaVoice = {
  openerStyle: "warm_fr" | "neutral_fr" | "premium_fr";
  signOffChance01: number;
  /** Fragment système pour prompts secondaires (WhatsApp template, email court) */
  systemVoiceHint: string;
};

const VOICES: Record<string, AgentPersonaVoice> = {
  bryan: {
    openerStyle: "warm_fr",
    signOffChance01: 0.12,
    systemVoiceHint:
      "Voix Bryan : phrases courtes, calme, naturel Afrique francophone pro — jamais bot, jamais markdown.",
  },
  vanessa: {
    openerStyle: "premium_fr",
    signOffChance01: 0.1,
    systemVoiceHint:
      "Voix Vanessa : précise, élégante, chaleureuse — pas de Familiarité excessive, pas de slogan.",
  },
  default: {
    openerStyle: "neutral_fr",
    signOffChance01: 0.08,
    systemVoiceHint: "Même ton que l’agent OPTIMA sélectionné — réponses humaines messagerie.",
  },
};

export function resolveAgentPersonaVoice(personaKey?: string | null): AgentPersonaVoice {
  const k = String(personaKey ?? "")
    .trim()
    .toLowerCase();
  if (k && VOICES[k]) return VOICES[k]!;
  return VOICES.default!;
}

export function formatAutomationPersonalityLockBlock(personaKey?: string | null): string {
  const v = resolveAgentPersonaVoice(personaKey);
  return [
    "ACTION PERSONALITY LOCK:",
    `- ${v.systemVoiceHint}`,
    "- Toute automatisation (email, WhatsApp, rappel) réutilise strictement ce registre — pas de reset de ton.",
  ].join("\n");
}
