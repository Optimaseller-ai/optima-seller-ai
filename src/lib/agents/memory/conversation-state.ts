/**
 * Types partagés — mémoire comportementale prospect + intention (Optima Seller AI).
 * Importable côté client et serveur (pas de server-only ici).
 */

import type { ProspectProfile } from "./prospect-profile";

export type ProspectTone =
  | "hesitant"
  | "aggressive"
  | "rushed"
  | "curious"
  | "loyal"
  | "cold"
  | "warm"
  | "ready_to_buy"
  | "neutral";

export type InterestLevel = "cold" | "warm" | "hot";

export type LanguageStylePreference = "formal" | "neutral" | "warm";

export type ConversationProfile = {
  tone: ProspectTone;
  interestLevel: InterestLevel;
  /** 0–100 estimation */
  buyingIntent: number;
  preferredProducts: string[];
  lastTopics: string[];
  preferredLanguageStyle: LanguageStylePreference;
};

export type SellerIntent =
  | "price_inquiry"
  | "stock_inquiry"
  | "delivery_inquiry"
  | "negotiation"
  | "complaint"
  | "curiosity"
  | "purchase_intent"
  | "greeting"
  | "spam"
  | "off_topic"
  | "other";

export type ProductMemory = {
  viewedProducts: string[];
  budgetHint?: string;
  lastMentionedInterest?: string;
};

/** Mémoire longue côté vente: objections, goûts, préférences — pour relances et propositions. */
export type CommercialMemory = {
  likedProducts: string[];
  objections: string[];
  preferences: string[];
  budgetNotes?: string;
  lastObjectionSnippet?: string;
};

export type RegionStyle = "standard" | "west_africa";

/** Suivi salutations / présentation / fréquence emojis (côté serveur + client). */
export type ConversationalEtiquette = {
  /** Au moins une salutation a été envoyée par le prospect dans ce fil (cumul). */
  prospectEverSentGreeting?: boolean;
  /** Une présentation type « je suis … chez … » a déjà été faite. */
  businessPresentationDone?: boolean;
  /**
   * Compteur de réponses assistant depuis le dernier message contenant un emoji.
   * Règle produit : au plus 1 emoji toutes les 8 réponses ; on autorise un emoji si ce compteur >= 7.
   */
  repliesSinceLastEmoji?: number;
};

/** État enrichi sérialisé dans la session chat (localStorage + API). */
export type SellerBehaviorConversationState = {
  /** Langue conversationnelle persistée (détection auto + sticky). */
  language?: "fr" | "en" | "es";
  preferences?: { blacklist?: string[] };
  mood?: string;
  memory?: string[];
  tone_mode?: "chill" | "premium" | "vendeur_soft" | "support_client" | "conversation_naturelle";
  /** turn_count = nombre de messages utilisateur déjà fusionnés dans l’état (incrément serveur à chaque envoi prospect). */
  stats?: { turn_count?: number; fatigue?: number; last_active_at?: number };
  /** Évite les « Bonjour Monsieur » répétés et encadre les salutations. */
  conversationalEtiquette?: ConversationalEtiquette;
  conversationProfile?: ConversationProfile;
  lastSellerIntent?: SellerIntent;
  productMemory?: ProductMemory;
  commercialMemory?: CommercialMemory;
  /** Titres type Monsieur / Chef / Patron (Afrique francophone, sobre) */
  regionStyle?: RegionStyle;
  /** Données UI client (avatar, etc.) — ignorées côté modèle si non utilisées */
  agent_profile?: unknown;
  /** Mémoire durable: civilité, prénom, habitudes, ton — enrichi côté serveur */
  prospectProfile?: ProspectProfile;
};

export const DEFAULT_CONVERSATION_PROFILE: ConversationProfile = {
  tone: "neutral",
  interestLevel: "cold",
  buyingIntent: 25,
  preferredProducts: [],
  lastTopics: [],
  preferredLanguageStyle: "neutral",
};
