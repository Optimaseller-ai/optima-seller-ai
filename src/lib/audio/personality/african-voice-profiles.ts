/**
 * Profils voix — ton commercial africain moderne, sobre, WhatsApp-native.
 * Pas de voix « assistant US » par défaut.
 */

export type AfricanVoiceProfileId =
  | "african_male_young_commercial"
  | "african_female_young_commercial"
  | "african_female_calm_premium"
  | "african_male_warm_advisor";

export type AfricanVoiceProfile = {
  id: AfricanVoiceProfileId;
  label: string;
  gender: "male" | "female";
  /** OpenAI TTS voice id (sobre, naturel) */
  ttsVoice: "onyx" | "echo" | "nova" | "shimmer" | "fable" | "alloy";
  speed: number;
  pitchHint: string;
  energy: "calm" | "balanced" | "dynamic";
};

export const AFRICAN_VOICE_PROFILES: Record<AfricanVoiceProfileId, AfricanVoiceProfile> = {
  african_male_young_commercial: {
    id: "african_male_young_commercial",
    label: "Homme jeune — commercial naturel",
    gender: "male",
    ttsVoice: "echo",
    speed: 1.02,
    pitchHint: "Jeune, posé, pas radio US",
    energy: "dynamic",
  },
  african_female_young_commercial: {
    id: "african_female_young_commercial",
    label: "Femme jeune — conseillère chaleureuse",
    gender: "female",
    ttsVoice: "nova",
    speed: 0.98,
    pitchHint: "Claire, humaine, professionnelle",
    energy: "balanced",
  },
  african_female_calm_premium: {
    id: "african_female_calm_premium",
    label: "Femme — calme premium",
    gender: "female",
    ttsVoice: "shimmer",
    speed: 0.94,
    pitchHint: "Rassurante, élégante",
    energy: "calm",
  },
  african_male_warm_advisor: {
    id: "african_male_warm_advisor",
    label: "Homme — conseiller chaleureux",
    gender: "male",
    ttsVoice: "onyx",
    speed: 0.96,
    pitchHint: "Chaleureux, structuré",
    energy: "balanced",
  },
};
