import { DateTime } from "luxon";
import { z } from "zod";
import { openRouterKeepAliveAgent } from "@/lib/ai/openrouter";
import { resolveBusinessTimezone } from "@/lib/ai/businessTimezoneResolver";
import { serverEnv } from "../server-env";
import { createClient as createSupabaseServerClient } from "../supabase/server";
import {
  ALLOWED_MODELS,
  CORE_MODES,
  chatCoreRequestSchema,
  type AllowedModel,
  type CoreMode,
} from "./chat-core.schema";
import { type BusinessProfile, formatWhoAmIResponse, isWhoAmIIntent } from "./whoami";
import { ANALYSIS_PROMPT } from "./sales/analysis-engine";
import { STRATEGY_INSTRUCTIONS } from "./sales/strategy-dispatcher";
import { OBJECTION_HANDLING_GUIDE } from "./sales/objection-detector";
import { UPSELL_GUIDELINES } from "./sales/upsell-engine";
import { ANTI_AGGRESSIVE_RULES } from "./sales/guardrails";
import { type SupervisorInsights, type ProspectAnalysis } from "./sales/types";
import { classifyIntent, getDeterministicResponse, getQuickResponse, type Intent } from "./intent-classifier";

export { chatCoreRequestSchema } from "./chat-core.schema";

export type ChatCoreCapabilities = {
  realtime: boolean;
  webSearch: boolean;
  businessMemory: boolean;
  timezone: string;
  currentDateTime: string;
};

export type MemoryDebugStatus =
  | { status: "PROFILE_FOUND"; userId: string; fields: Record<string, boolean> }
  | { status: "PROFILE_EMPTY"; reason: string }
  | { status: "AUTH_MISSING" };

export type ChatCoreResponse =
  | { ok: true; data: { id: string | null; model: string; message: string; capabilities: ChatCoreCapabilities; insights: SupervisorInsights | null } }
  | { ok: false; status: number; error: string };

const AI_TONE_BLACKLIST = [
  // "I'm here to help" variants
  "Je suis là pour vous aider",
  "Je suis ici pour vous aider",
  "Je suis là pour t'aider",
  "Je suis ici pour t'aider",
  "Je peux vous aider",
  "Je peux t'aider",
  "Puis-je vous aider",
  "Puis-je t'aider",
  "Comment puis-je vous aider",
  "Comment puis-je t'aider",
  "Comment puis-je vous assister",
  "Comment puis-je t'assister",
  "Que puis-je faire pour vous",
  "Que puis-je faire pour toi",
  
  // "I understand" variants
  "Je comprends",
  "Je comprend",
  "Je sais que",
  "Je vois que",
  "Je remarque que",
  
  // "No problem" variants
  "Pas de souci",
  "Pas de problème",
  "C'est pas grave",
  "T'inquiète pas",
  "Vous inquiétez pas",
  "Pas d'inquiétude",
  
  // "Searching/Looking for" forced questions
  "Cherchez-vous",
  "Tu cherches",
  "Vous cherchez",
  "Tu cherches des",
  "Vous cherchez des",
  "Que cherchez-vous",
  "Qu'est-ce que tu cherches",
  
  // "Don't hesitate" variants
  "N'hésitez pas",
  "N'hésite pas",
  "N'hésite pas à",
  "N'hésitez pas à",
  "N'hésite pas de",
  "N'hésitez pas de",
  
  // "Let me know" variants
  "Faites-moi savoir",
  "Fais-moi savoir",
  "Laissez-moi savoir",
  "Laisse-moi savoir",
  
  // "I would be happy" variants
  "Je serais heureux",
  "Je serais heureuse",
  "Je serais ravi",
  "Je serais ravie",
  "Je serais enchanté",
  "Je serais enchanté",
  
  // AI-specific phrases
  "Je suis une IA",
  "Je suis un chatbot",
  "Je suis une intelligence artificielle",
  "Je suis juste une IA",
  "Je suis un assistant",
  "Je suis votre assistant",
  "Je suis ton assistant",
  "Comme un assistant IA",
  "En tant qu'IA",
  "En tant qu'assistant",
  
  // Generic follow-ups to avoid
  "Si vous avez des questions",
  "Si tu as des questions",
  "Si vous avez besoin",
  "Si tu as besoin",
  "Avez-vous d'autres questions",
  "As-tu d'autres questions",
  "Avez-vous d'autres besoins",
  "As-tu d'autres besoins",

  // Strict anti-generic support phrases (French)
  "Comment puis-je vous aider",
  "Comment puis-je vous assister",
  "Je suis là pour vous aider",
  "Je suis là pour t'aider",
  "N’hésitez pas",
  "N'hésitez pas",
  "Je comprends",
  "Je suis désolé",
  "Je suis désolée",
  "Désolé",
  "Je peux vous assister",
  "Avez-vous besoin d'autre chose",
  "Avez-vous besoin d’autre chose",
  "Je reste disponible",
  "Je reste à votre disposition",
  "Je vais faire de mon mieux",
  "Tu cherches des informations",
  "Tu cherches des infos",
];

function cleanAITone(text: string, preserveFacts: boolean = false): string {
   // If preserving facts, only do minimal cleaning to avoid modifying times, prices, etc.
   if (preserveFacts) {
     // Only remove excessive whitespace, don't touch content
     let cleaned = text
       .replace(/  +/g, " ")  // multiple spaces → single space
       .replace(/\t+/g, " ") // tabs → space
       .replace(/\n\s*\n\s*\n+/g, "\n\n") // triple+ newlines → double newline
       .trim();
   
     // Remove trailing question marks only if they're not part of a number or time
     // e.g., don't remove "5h22 ?" but do remove "Bonjour ?"
     cleaned = cleaned.replace(/\s*\?\s*$/, "").trim();
     
     // Remove empty lines
     const lines = cleaned.split("\n").filter(line => line.trim().length > 0);
     cleaned = lines.join("\n");
     return cleaned;
   }

   let cleaned = text;

   // Remove overly formal AI patterns (case-insensitive)
   for (const phrase of AI_TONE_BLACKLIST) {
     const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "gi");
     cleaned = cleaned.replace(regex, "");
   }

   // Clean up resulting double spaces, tabs, and extra newlines
   cleaned = cleaned
     .replace(/  +/g, " ")  // multiple spaces → single space
     .replace(/\t+/g, " ") // tabs → space
     .replace(/\n\s*\n\s*\n+/g, "\n\n") // triple+ newlines → double newline
     .trim();
   
   // Remove trailing question marks left behind from removed phrases
   // e.g., "Bonjour ?" after removing "Comment puis-je vous aider ?"
   cleaned = cleaned.replace(/\s*\?\s*$/, "").trim();
   
   // Remove lines that became empty after phrase removal
   const lines = cleaned.split("\n").filter(line => line.trim().length > 0);
   cleaned = lines.join("\n");
   return cleaned;
 }

function applyAntiAssumptionGuard(text: string, context: { 
   businessProfile: BusinessProfile | null;
   hasVerifiedHours: boolean;
   hasVerifiedInfo: boolean;
   userMessage: string;
}): string {
   // Patterns that indicate assumptions or invented information (BUG #1)
   const assumptionPatterns = [
     /peux?-t[ée]?/i,           // peut-être, peut être
     /s[ûu]rement/i,            // sûrement
     /probablement/i,           // probablement
     /il devait/i,              // il devait
     /elle devait/i,            // elle devait
     /sans doute/i,             // sans doute
     /d'après ce que je sais/i, // d'après ce que je sais
     /je pense que/i,           // je pense que
     /il semble que/i,          // il semble que
     /elle semble que/i,        // elle semble que
     /apparemment/i,            // apparemment
     /il paraît que/i,          // il paraît que
   ];

   // Patterns that indicate fake actions (BUG #5)
   const floatingActionPatterns = [
     /je vais vérifier/i,       // je vais vérifier
     /je regarde/i,             // je regarde
     /je confirme/i,            // je confirme
     /un instant/i,             // un instant
     /je vais voir/i,           // je vais voir
     /je vais demander/i,       // je vais demander
     /je vais regarder/i,       // je vais regarder
     /je vais vérifier/i,       // je vais vérifier
     /je vais confirmer/i,      // je vais confirmer
     /je vais voir ce que/i,    // je vais voir ce que
     /je vais appeler/i,        // je vais appeler
     /je vais consulter/i,      // je vais consulter
     /je vais appeler/i,        // je vais appeler
   ];

   // Check if the text contains assumption patterns
   const hasAssumption = assumptionPatterns.some(pattern => pattern.test(text));
   const hasFloatingAction = floatingActionPatterns.some(pattern => pattern.test(text));

   // If we detect assumptions or floating actions, we should rewrite the response to be more cautious
   if (hasAssumption || hasFloatingAction) {
     // Special handling for hours inquiries when we don't have hours info (BUG #2)
     if (/heure|ouverture|fermeture|horaires/i.test(text) && context.hasVerifiedHours === false) {
       return "Je n’ai pas encore les horaires exacts de la boutique. Je vous conseille de contacter directement le responsable avant de vous déplacer.";
     }
     
     // Instead of inventing reasons or fake actions, use safe, professional responses
     const safeResponses = [
       "Je comprends votre situation.",
       "Désolé pour ce contretemps.",
       "Je vais faire de mon mieux pour vous aider.",
       "Souhaitez-vous que je vous aide autrement ?",
       "Pouvez-vous me préciser votre demande ?",
       "Je reste à votre disposition pour toute assistance."
     ];
     
     // Return a safe generic response instead of the assumption-filled one
     return safeResponses[Math.floor(Math.random() * safeResponses.length)];
   }

   return text;
 }

// Human reply library for more natural, boutique-style responses (BUG #4)
const HUMAN_REPLY_LIBRARY = {
   greeting: [
      "Bonjour ! Comment puis-je vous aider aujourd'hui ?",
      "Bonjour, bienvenue ! Que puis-je faire pour vous ?",
      "Salut ! Vous cherchez quelque chose en particulier ?"
   ],
   thanks: [
      "Je vous en prie !",
      "Avec plaisir !",
      "C'était naturel !"
   ],
   ok: [
      "Parfait !",
      "D'accord !",
      "Très bien !"
   ],
   howAreYou: [
      "Je vais très bien, merci ! Et vous ?",
      "Ça va bien, merci de demander ! Et toi ?",
      "Je suis en forme ! Et toi, ça va ?"
   ],
   unknownInfo: [
      "Je n’ai pas encore cette information précise.",
      "Je ne dispose pas de ces détails pour le moment.",
      "Cette information n'est pas encore dans notre système.",
      "Je vous suggère de vérifier directement auprès du service concerné."
   ],
   cantHelp: [
      "Je comprends votre situation.",
      "Désolé pour ce contretemps.",
      "Je vais faire de mon mieux pour vous aider autrement.",
      "Souhaitez-vous que je vous transfère vers quelqu'un qui peut mieux vous aider ?"
   ],
   professionalClosing: [
      "N’hésitez pas si vous avez besoin d’autre chose.",
      "Je reste disponible pour vous aider.",
      "Vous pouvez aussi repasser plus tard.",
      "D’accord, je vous attends pour la suite."
   ]
};

function getHumanReply(category: string): string {
   const replies = HUMAN_REPLY_LIBRARY[category as keyof typeof HUMAN_REPLY_LIBRARY];
   if (replies && replies.length > 0) {
      return replies[Math.floor(Math.random() * replies.length)];
   }
   return "Je comprends votre demande.";
}

// Trust scoring function to evaluate response quality (BUG #6)
function calculateTrustScore(response: string, context: {
   businessProfile: BusinessProfile | null;
   hasVerifiedHours: boolean;
   hasVerifiedInfo: boolean;
   userAskedAboutHours: boolean;
   userAskedAboutInfo: string[]; // List of info types user asked about
}): number {
   let score = 100; // Start with perfect score
   
   // BUG #1: Deduct for assumption patterns (invented information)
   const assumptionPatterns = [
      /peux?-t[ée]?/i,
      /s[ûu]rement/i,
      /probablement/i,
      /il devait/i,
      /elle devait/i,
      /sans doute/i,
      /d'après ce que je sais/i,
      /je pense que/i,
      /il semble que/i,
      /elle semble que/i,
      /apparemment/i,
      /il paraît que/i
   ];
   
   assumptionPatterns.forEach(pattern => {
      if (pattern.test(response)) {
         score -= 25; // Significant deduction for assumptions
      }
   });
   
   // BUG #5: Deduct for floating actions when no backend action exists
   const floatingActionPatterns = [
      /je vais vérifier/i,
      /je regarde/i,
      /je confirme/i,
      /un instant/i,
      /je vais voir/i,
      /je vais demander/i,
      /je vais appeler/i,
      /je vais consulter/i
   ];
   
   floatingActionPatterns.forEach(pattern => {
      if (pattern.test(response)) {
         score -= 30; // Even more serious for fake actions
      }
   });
   
   // BUG #2 & #3: Special handling for missing information
   // Penalize for claiming to check/know something we don't have
   if (context.userAskedAboutHours && 
       context.hasVerifiedHours === false &&
      /je vais vérifier|je regarde|je confirme|un instant|je sais|je connais/i.test(response)) {
      score -= 35;
   }
   
   // Check for other specific missing info types
   context.userAskedAboutInfo.forEach(infoType => {
      if (!context.hasVerifiedInfo && 
         /je vais vérifier|je regarde|je confirme|un instant|je sais|je connais/i.test(response)) {
         score -= 25;
      }
   });
   
   // BUG #4: Bonus for using natural, professional human-like responses
   const humanPatterns = [
      /n.hésitez pas/i,
      /je reste disponible/i,
      /repasser plus tard/i,
      /d’accord.*je vous attends/i,
      /je comprends/i,
      /désolé/i,
      /je vais faire de mon mieux/i
   ];
   
   humanPatterns.forEach(pattern => {
      if (pattern.test(response)) {
         score += 15; // Reward for natural human responses
      }
   });
   
   // BUG #3: Bonus for admitting lack of information honestly (instead of inventing)
   const honestyPatterns = [
      /je n'ai pas/i,
      /je ne dispose pas/i,
      /cette information n'est pas/i,
      /je ne sais pas/i,
      /je ne connais pas/i,
      /pas encore dans notre système/i
   ];
   
   honestyPatterns.forEach(pattern => {
      if (pattern.test(response)) {
         score += 20; // Significant reward for honesty
      }
   });
   
   // Ensure score stays in bounds
   return Math.max(0, Math.min(100, score));
}

// Human reply library for more natural, boutique-style responses
const HUMAN_REPLY_LIBRARY = {
   greeting: [
      "Bonjour ! Comment puis-je vous aider aujourd'hui ?",
      "Bonjour, bienvenue ! Que puis-je faire pour vous ?",
      "Salut ! Vous cherchez quelque chose en particulier ?"
   ],
   thanks: [
      "Je vous en prie !",
      "Avec plaisir !",
      "C'était naturel !"
   ],
   ok: [
      "Parfait !",
      "D'accord !",
      "Très bien !"
   ],
   howAreYou: [
      "Je vais très bien, merci ! Et vous ?",
      "Ça va bien, merci de demander ! Et toi ?",
      "Je suis en forme ! Et toi, ça va ?"
   ],
   unknownInfo: [
      "Je n’ai pas encore cette information précise.",
      "Je ne dispose pas de ces détails pour le moment.",
      "Cette information n'est pas encore dans notre système.",
      "Je vous suggère de vérifier directement auprès du service concerné."
   ],
   cantHelp: [
      "Je comprends votre situation.",
      "Désolé pour ce contretemps.",
      "Je vais faire de mon mieux pour vous aider autrement.",
      "Souhaitez-vous que je vous transfère vers quelqu'un qui peut mieux vous aider ?"
   ]
};

function getHumanReply(category: string): string {
   const replies = HUMAN_REPLY_LIBRARY[category as keyof typeof HUMAN_REPLY_LIBRARY];
   if (replies && replies.length > 0) {
      return replies[Math.floor(Math.random() * replies.length)];
   }
   return "Je comprends votre demande.";
}

// Trust scoring function to evaluate response quality
function calculateTrustScore(response: string, context: {
   businessProfile: BusinessProfile | null;
   hasVerifiedHours: boolean;
   hasVerifiedInfo: boolean;
   userAskedAboutHours: boolean;
}): number {
   let score = 100; // Start with perfect score
   
   // Deduct for assumption patterns
   const assumptionPatterns = [
      /peux?-t[ée]?/i,
      /s[ûu]rement/i,
      /probablement/i,
      /il devait/i,
      /elle devait/i,
      /sans doute/i,
      /d'après ce que je sais/i,
      /je pense que/i,
      /il semble que/i,
      /elle semble que/i,
      /apparemment/i,
      /il paraît que/i
   ];
   
   assumptionPatterns.forEach(pattern => {
      if (pattern.test(response)) {
         score -= 20; // Significant deduction for assumptions
      }
   });
   
   // Deduct for floating actions when no backend action exists
   const floatingActionPatterns = [
      /je vais vérifier/i,
      /je regarde/i,
      /je confirme/i,
      /un instant/i,
      /je vais voir/i,
      /je vais demander/i,
      /je vais appeler/i
   ];
   
   floatingActionPatterns.forEach(pattern => {
      if (pattern.test(response)) {
         score -= 25; // Even more serious for fake actions
      }
   });
   
   // Special penalty for claiming to check hours when we don't have them
   if (context.userAskedAboutHours && 
       context.hasVerifiedHours === false &&
      /je vais vérifier|je regarde|je confirme|un instant/i.test(response)) {
      score -= 30;
   }
   
   // Bonus for admitting lack of information honestly
   const honestyPatterns = [
      /je n'ai pas/i,
      /je ne dispose pas/i,
      /cette information n'est pas/i,
      /je ne sais pas/i,
      /je ne connais pas/i
   ];
   
   honestyPatterns.forEach(pattern => {
      if (pattern.test(response)) {
         score += 10; // Reward for honesty
      }
   });
   
   // Ensure score stays in bounds
   return Math.max(0, Math.min(100, score));
}

const SYSTEM_PROMPT = [
  "You are a real human sales/customer service rep for the business (mobile chat, short messages).",
  "You are never presented as a chatbot or generic AI assistant.",
  "",
  "═══════════════════════════════════════════════════════════════",
  "CORE BEHAVIOR (CRITICAL):",
  "═══════════════════════════════════════════════════════════════",
  "",
  "1️⃣  PROFESSIONAL HUMAN EMPLOYEE",
  "   - Speak like a premium customer advisor",
  "   - Respectful, calm, and business-focused",
  "   - Natural and warm, never robotic",
  "   - No teenage slang or overfamiliar style",
  "",
  "2️⃣  FORM OF ADDRESS (CRITICAL)",
  "   - Use 'vous' by default in French.",
  "   - Never start with tutoiement.",
  "   - You may switch to 'tu' only if the prospect repeatedly uses tutoiement in a relaxed discussion.",
  "",
  "3️⃣  ENERGY VARIES BY MOOD OF PROSPECT",
  "   User is excited → Match excitement, be energetic (still brief)",
  "   User is hesitant → Be warm, reassuring, calm (reduce pressure)",
  "   User is frustrated → Be professional, solution-focused (fix quickly)",
  "   User is neutral → Be direct and efficient",
  "   User is joking → Light humor, natural tone",
  "   Adapt your tone AUTOMATICALLY.",
  "",
  "4️⃣  NEVER WRITE FAQ OR CHATGPT RESPONSES",
  "   Forbidden: output none of the generic support-script phrases.",
  "   Strict blacklist (examples):",
  "   - 'Comment puis-je vous aider ?'",
  "   - 'Je suis là pour vous aider.'",
  "   - 'N’hésitez pas.'",
  "   - 'Je comprends.'",
  "   - 'Je suis désolé.'",
  "   - 'Je peux vous assister.'",
  "   - 'Avez-vous besoin d’autre chose ?'",
  "   - 'Je reste disponible.'",
  "   - 'Je vais faire de mon mieux.'",
  "   - 'Tu cherches des informations ?'",
  "   Prefer a direct, human mobile-chat reply (short, imperfect, natural).",
  "",
  "5️⃣  MAX LENGTH: 2 SHORT SENTENCES",
  "   Mobile-first and clear.",
  "   One concise message is preferred.",
  "",
  "6️⃣  EMOTIONAL MEMORY",
  "   - Detect prospect's emotional state",
  "   - If they complain → Show empathy + action",
  "   - If they're interested → Get excited too",
  "   - If they're cold → Warm it up naturally",
  "   - If they joke → Joke back",
  "   Your tone follows their energy.",
  "",
  "7️⃣  PROFESSIONAL GREETINGS",
  "   For a first greeting, use service-level welcomes such as:",
  "   - 'Bonjour et bienvenue chez {business_name}. Je suis {agent_name} du service client.'",
  "   - 'Bonsoir Monsieur, bienvenue chez {business_name}.'",
  "   - 'Bonjour Madame, bienvenue chez {business_name}.'",
  "   Avoid familiar greetings like 'hey', 'yo', 'coucou'.",
  "",
  "8️⃣  DETECTION OF BUYING INTENT → PREMIUM SELLER MODE",
  "   When prospect shows interest (asks price, availability, etc.):",
  "   - Become MORE professional (not cold, just polished)",
  "   - More reassuring",
  "   - Solution-oriented",
  "   - Confident but not pushy",
  "   - Guide them toward decision",
  "",
  "9️⃣  NO ROBOTIC DISCLAIMERS",
  "   ❌ 'Je suis là pour vous aider'",
  "   ❌ 'Je comprends'",
  "   ❌ 'Je suis une IA'",
  "   ❌ 'Comme mentionné'",
  "   ✅ Just be human",
  "",
   "🔟 IF UNSURE → ASK ONE CLEAR QUESTION",
   "   ✅ 'Quel modèle vous intéresse le plus ?'",
   "   ✅ 'Quelle taille souhaitez-vous ?'",
   "   ✅ 'Pour quelle date, s'il vous plaît ?'",
   "",
   "1️⃣1️⃣  NE JAMAIS INVENTER D'INFORMATIONS",
   "   ❌ Ne jamais inventer d'excuses, de justifications, d'émotions ou de raisons internes",
   "   ❌ Si l'information n'est pas dans le business profile, la mémoire, la FAQ, les horaires ou les notes staff",
   "   ✅ À la place : admettre clairement le manque d'information et répondre avec prudence professionnelle",
   "   ✅ Exemples : 'Je comprends.', 'Désolé pour cela.', 'Je vais vous aider.', 'Souhaitez-vous revenir plus tard ou laisser un message ?'",
   "",
   "1️⃣2️⃣  ÉVITER LES RÉPONSES FLOTTANTES",
   "   ❌ Ne jamais prétendre vérifier, regarder, confirmer ou dire 'un instant' si aucune action backend réelle n'existe",
   "   ✅ Ne promettre une action que si elle est effectivement exécutée par le système",
   "",
   "═══════════════════════════════════════════════════════════════",
   "LANGUAGE:",
   "═══════════════════════════════════════════════════════════════",
   "- French by default, adapt if user switches languages",
   "- Use 'vous' by default. Switch to 'tu' only after repeated user tutoiement.",
   "- Use {business_name} and {agent_name} naturally",
   "- Emojis are optional and rare (0 or 1 max when truly natural)",
   "- Never stack multiple emojis",
   "",
   "═══════════════════════════════════════════════════════════════",
   "GOAL:",
   "═══════════════════════════════════════════════════════════════",
   "Prospect thinks: 'This is a real person from the business team'",
   "NOT: 'This is ChatGPT pretending to be human'",
   "═══════════════════════════════════════════════════════════════",
].join("\n");

function modeInstruction(mode: CoreMode) {
  switch (mode) {
    case "business_chat":
      return [
        "MODE: Business advisor (not customer)",
        "Help with strategy, writing, rewriting, thinking.",
        "Be practical. Be direct. No fluff. No questions unless needed.",
      ].join("\n");
    case "reply":
      return [
        "MODE: Reply to customer (MOST IMPORTANT)",
        "",
        "CRITICAL: Be a professional human employee, never generic AI.",
        "Start in vouvoiement and keep a premium service tone.",
        "",
        "SHORT REACTIONS (when appropriate):",
        "  'Bien reçu.'",
        "  'Avec plaisir Monsieur.'",
        "  'Je vous en prie.'",
        "  'Très bien, je vérifie cela.'",
        "",
        "MATCH THEIR ENERGY:",
        "  If excited → Match excitement",
        "  If hesitant → Be warm & reassuring",
        "  If frustrated → Be solution-focused",
        "  If joking → Joke back",
        "",
        "VARIABLE TONE (always professional):",
        "  Sometimes direct, sometimes warm, never casual slang.",
        "  Keep credibility and trust first.",
        "",
        "LENGTH: Keep it SHORT. 1-2 sentences max.",
        "If more to say, send in 2 quick separate messages.",
      ].join("\n");
    case "followup":
      return [
        "MODE: Follow up with prospect",
        "Customer went quiet. Restart naturally.",
        "Be human and professional - show genuine interest, not desperation.",
        "Examples:",
        "  'Souhaitez-vous que je vous réserve cela ?'",
        "  'Souhaitez-vous que nous finalisions votre commande ?'",
        "  'Voulez-vous que je vous envoie les détails ?'",
        "  'Avez-vous une préférence précise avant validation ?'",
      ].join("\n");
    case "closing":
      return [
        "MODE: Close the sale",
        "Customer wants to buy. Make it smooth & natural.",
        "Be confident but not pushy.",
        "Guide to next step: payment, booking, delivery.",
        "Keep it human - they're making a decision.",
      ].join("\n");
    case "complaint":
      return [
        "MODE: Handle complaint",
        "Customer is upset. Be real, empathetic, action-oriented.",
        "Don't over-apologize.",
        "Acknowledge + propose solutions quickly.",
        "Show you care about fixing it.",
      ].join("\n");
    case "promo":
      return [
        "MODE: Promotional message",
        "Write like a real seller on social / mobile chat.",
        "Engaging, clear CTA, brief.",
        "Make people WANT to engage.",
        "Use emojis naturally, not forced.",
      ].join("\n");
  }
}

function normalizeTimezone(raw: string | undefined) {
  const tz = (raw ?? "").trim();
  if (!tz) return "Africa/Douala";
  try {
    const dt = DateTime.now().setZone(tz);
    return dt.isValid ? tz : "Africa/Douala";
  } catch {
    return "Africa/Douala";
  }
}

function detectProspectEmotion(userMessage: string): "excited" | "hesitant" | "frustrated" | "neutral" | "joking" {
  const msg = String(userMessage ?? "").toLowerCase().trim();
  
  // Excited indicators
  if (/(super|trop|wow|ouais|oui oui|génial|intéressant|cool|sympa|parfait|excellent|top|awesome|yay|🔥|⚡|😍|🎉)/i.test(msg)) {
    return "excited";
  }
  
  // Frustrated/Angry indicators
  if (/(cher|trop cher|pas bon|nul|débile|angry|frustré|marre|pas d'accord|n'aime pas|horrible|😠|😡|🤬)/i.test(msg)) {
    return "frustrated";
  }
  
  // Hesitant/Unsure indicators
  if (/(hésit|peut-être|sais pas|pas sûr|doute|réfléchir|attendre|plutôt|pas vraiment|euh|hmm|🤔|😕)/i.test(msg)) {
    return "hesitant";
  }
  
  // Joking/Playful indicators
  if (/(😂|😄|😆|😉|blague|rigole|haha|lol|😏|😜)/i.test(msg)) {
    return "joking";
  }
  
  return "neutral";
}

function detectBuyingIntent(userMessage: string): boolean {
  const msg = String(userMessage ?? "").toLowerCase().trim();
  return /(combien|prix|coûte|payer|paiement|commander|acheter|réserver|booking|livraison|quand|disponible|stock|intéressé|je veux|tu peux|on peut|c'est possible)/i.test(msg);
}

// NOTE: We intentionally avoid caching profile lookups. In production, stale profile context is worse
// than an extra read on each AI request, because it makes the assistant behave like it "forgot" the business.

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildProfileContext(profile: BusinessProfile, opts?: { memoryLevel?: "limited" | "advanced" }) {
  const isAdvanced = opts?.memoryLevel === "advanced";

  // Canonical memory block (must remain stable; referenced by QA).
  // This is injected into the hidden system prompt before every generation.
  const contextLines = [
    profile.businessName ? `You are assistant for ${profile.businessName}` : null,
    profile.businessType ? `Sector: ${profile.businessType}` : null,
    profile.city ? `City: ${profile.city}` : null,
    profile.country ? `Country: ${profile.country}` : null,
    profile.offer ? `Offer: ${profile.offer}` : null,
    profile.mainGoal ? `Goal: ${profile.mainGoal}` : null,
    // Advanced memory extras
    isAdvanced && profile.ownerName ? `Owner name: ${profile.ownerName}` : null,
    isAdvanced && profile.contactPhone ? `Business contact line: ${profile.contactPhone}` : null,
    isAdvanced && profile.brandTone ? `Brand tone: ${profile.brandTone}` : null,
    isAdvanced && profile.responseStyle ? `Response style: ${profile.responseStyle}` : null,
    isAdvanced && profile.primaryLanguage ? `Primary language: ${profile.primaryLanguage}` : null,
  ].filter(Boolean);

  return contextLines.length ? contextLines.join("\n") : null;
}

async function loadBusinessProfileContext(opts?: {
  memoryLevel?: "limited" | "advanced";
}): Promise<{ context: string | null; profile: BusinessProfile | null }> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    let user = userData.user ?? null;

    if (!user) {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      user = sessionData.session?.user ?? null;
      if (!user) {
        console.log("[AI][MEMORY] PROFILE_EMPTY auth_user=null", {
          userErr: userErr?.message ?? null,
          sessionErr: sessionErr?.message ?? null,
        });
        return { context: null, profile: null };
      }
    }

    const { data: profile, error: dbErr } = await supabase
      .from("profiles")
      .select(
        "updated_at,full_name,business_name,business_type,goal,country,city,whatsapp,offer,email,first_name,shop_name,main_goal,whatsapp_number,offer_description",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (dbErr) {
      console.log("[AI][MEMORY] PROFILE_EMPTY db_error", { message: dbErr.message, code: (dbErr as any)?.code ?? null });
      return { context: null, profile: null };
    }

    if (!profile) {
      console.log("[AI][MEMORY] PROFILE_EMPTY row_missing", { userId: user.id });
      return { context: null, profile: null };
    }
    const record = profile as Record<string, unknown>;

    const ownerName = isNonEmptyString(record.full_name)
      ? record.full_name
      : isNonEmptyString(record.first_name)
        ? record.first_name
        : null;

    const businessName = isNonEmptyString(record.business_name)
      ? record.business_name
      : isNonEmptyString(record.shop_name)
        ? record.shop_name
        : null;

    const mainGoal = isNonEmptyString(record.goal)
      ? record.goal
      : isNonEmptyString(record.main_goal)
        ? record.main_goal
        : null;

    const contactPhone = isNonEmptyString(record.whatsapp)
      ? record.whatsapp
      : isNonEmptyString(record.whatsapp_number)
        ? record.whatsapp_number
        : null;

    const offer = isNonEmptyString(record.offer)
      ? record.offer
      : isNonEmptyString(record.offer_description)
        ? record.offer_description
        : null;

    const businessProfile: BusinessProfile = {
      ownerName,
      businessName,
      businessType: isNonEmptyString(record.business_type) ? record.business_type : null,
      country: isNonEmptyString(record.country) ? record.country : null,
      city: isNonEmptyString(record.city) ? record.city : null,
      contactPhone,
      mainGoal,
      brandTone: null,
      responseStyle: null,
      primaryLanguage: null,
      offer,
    };

    const context = buildProfileContext(businessProfile, opts);

    const isEmpty = !context;
    console.log(isEmpty ? "[AI][MEMORY] PROFILE_EMPTY fields_empty" : "[AI][MEMORY] PROFILE_FOUND", {
      userId: user.id,
      hasContext: Boolean(context),
      fields: {
        ownerName: Boolean(ownerName),
        businessName: Boolean(businessName),
        businessType: Boolean(businessProfile.businessType),
        country: Boolean(businessProfile.country),
        city: Boolean(businessProfile.city),
        offer: Boolean(offer),
        goal: Boolean(mainGoal),
      },
    });

    return { context, profile: businessProfile };
  } catch {
    console.log("[AI][MEMORY] PROFILE_EMPTY unexpected_error");
    return { context: null, profile: null };
  }
}

async function openRouterChat(args: {
  model: AllowedModel;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature: number;
  timeoutMs: number;
}) {
  if (!serverEnv.OPENROUTER_API_KEY) {
    return { ok: false as const, status: 500, error: "Missing OPENROUTER_API_KEY on server." };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${serverEnv.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    Connection: "keep-alive",
  };
  if (serverEnv.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = serverEnv.OPENROUTER_SITE_URL;
  if (serverEnv.OPENROUTER_APP_NAME) headers["X-OpenRouter-Title"] = serverEnv.OPENROUTER_APP_NAME;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);

  const started = Date.now();
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    signal: controller.signal,
    dispatcher: openRouterKeepAliveAgent,
    body: JSON.stringify({
      model: args.model,
      temperature: args.temperature,
      messages: args.messages,
      tools: [
        {
          type: "openrouter:web_search",
          parameters: {
            engine: "auto",
            max_results: 5,
            max_total_results: 10,
            search_context_size: "medium",
          },
        },
      ],
    }),
  } as RequestInit).finally(() => clearTimeout(timeout));

  const durationMs = Date.now() - started;
  console.log("[OPTIMA_AI_CHAT_CORE]", "openrouter_response", { status: resp.status, durationMs, model: args.model });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const errPayload = { status: resp.status, durationMs, snippet: text.slice(0, 400) };
    if (resp.status === 429 || resp.status >= 500) console.error("[OPTIMA_AI_ERROR]", errPayload);
    else console.error("[OPTIMA_AI_CHAT_CORE]", "openrouter_http_error", errPayload);
    return {
      ok: false as const,
      status: resp.status,
      error: `OpenRouter error (${resp.status}): ${text.slice(0, 400)}`,
    };
  }

  type OrChoice = { message?: { content?: unknown } };
  type OrResponse = { choices?: OrChoice[]; model?: string; id?: string };
  const data = (await resp.json()) as unknown as OrResponse;
  const content: unknown = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    return { ok: false as const, status: 502, error: "OpenRouter: invalid response." };
  }

  return { ok: true as const, data: { id: data.id ?? null, model: (data.model ?? args.model) as string, message: content } };
}

async function withRetries<T>(fn: () => Promise<T>, opts: { retries: number; baseDelayMs: number }): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = opts.baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function splitToThreeItems(text: string) {
  const trimmed = text.trim();
  const parsed = safeJsonParse(trimmed);
  const schema = z.object({ items: z.array(z.string()).min(1) });
  const result = schema.safeParse(parsed);
  if (result.success) return result.data.items.slice(0, 3);

  const lines = trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^(\d+[.)]\s+|[-*]\s+)/, ""));

  // heuristic grouping: split by blank lines if present
  const byBlocks = trimmed
    .split(/\n\s*\n/g)
    .map((b) => b.trim())
    .filter(Boolean);

  const candidates = byBlocks.length >= 3 ? byBlocks : lines;
  return candidates.slice(0, 3);
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function runChatCore(raw: unknown): Promise<ChatCoreResponse> {
  const parsed = chatCoreRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid request body." };
  }

  const plan = parsed.data.plan === "pro" ? "pro" : "free";

  const primaryModel: AllowedModel = parsed.data.model ?? "openai/gpt-4o-mini";
  const fallbackModels: AllowedModel[] = [
    "deepseek/deepseek-chat-v3",
    "anthropic/claude-3.5-sonnet",
    "perplexity/sonar",
  ].filter((m) => m !== primaryModel) as AllowedModel[];

  const mode: CoreMode = parsed.data.mode ?? "reply";
  const historyMaxAgeMs = plan === "pro" ? Infinity : 3 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const sanitizedHistory = parsed.data.history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => {
      if (!m.ts) return plan === "pro";
      const t = Date.parse(m.ts);
      if (!Number.isFinite(t)) return plan === "pro";
      return nowMs - t <= historyMaxAgeMs;
    })
    .slice(-8);

   const memoryLevel = plan === "pro" ? "advanced" : "limited";
   const businessProfileOverride = parsed.data.businessProfile ?? null;
   const businessProfileData = businessProfileOverride
     ? { profile: businessProfileOverride as BusinessProfile, context: buildProfileContext(businessProfileOverride as BusinessProfile, { memoryLevel }) }
     : await loadBusinessProfileContext({ memoryLevel });

   const businessProfileContext = businessProfileData.context;
   const businessProfile = businessProfileData.profile;

   const userTz = normalizeTimezone(parsed.data.userTimezone);
   const resolvedBusinessTz =
     businessProfile?.city || businessProfile?.country
       ? resolveBusinessTimezone({ city: businessProfile.city, country: businessProfile.country })
       : null;
   const effectiveTz = resolvedBusinessTz?.iana ?? userTz;
   const now = DateTime.now().setZone(effectiveTz);
   const current = `${now.toFormat("yyyy-LL-dd HH:mm")} (${effectiveTz})`;

   // INTENT CLASSIFICATION - MUST RUN BEFORE EMBEDDINGS AND LLM
   const intent = classifyIntent(parsed.data.message);
   console.log("[OPTIMA_ROUTER] {intent_detected: \"%s\"}", intent);

   // Define intents for which we disable sales mode (as per requirement)
   const salesDisabledIntents = new Set(["current_time", "weather", "calculator", "general_knowledge"]);
   const salesModeDisabled = salesDisabledIntents.has(intent);

   // QUICK PATH FOR SIMPLE MESSAGES - BYPASS EMBEDDINGS, VECTOR SEARCH, ORCHESTRATION
   const quickResponse = getQuickResponse(intent);
   if (quickResponse) {
     console.log("[OPTIMA_ROUTER] {route_selected: \"quick\", llm_bypassed: true, sales_mode_disabled: %s}", salesModeDisabled);
     const capabilities: ChatCoreCapabilities = {
       realtime: true,
       webSearch: false, // No web search needed for quick responses
       businessMemory: false, // No business memory needed for quick responses
       timezone: effectiveTz,
       currentDateTime: current,
     };
     return {
       ok: true,
       data: { 
         id: null, 
         model: "quick-path", 
         message: cleanAITone(quickResponse, true), // Preserve facts for quick responses
         capabilities,
         insights: null
       },
     };
   }

   // DETERMINISTIC ROUTES - BYPASS LLM COMPLETELY
   const deterministicResponse = getDeterministicResponse(intent, {
     timezone: effectiveTz,
     businessProfile,
     currentDateTime: current,
   });
   
   if (deterministicResponse) {
     console.log("[OPTIMA_ROUTER] {route_selected: \"deterministic\", llm_bypassed: true, sales_mode_disabled: %s}", salesModeDisabled);
     // DISABLE SALES MODE FOR DETERMINISTIC RESPONSES
     const capabilities: ChatCoreCapabilities = {
       realtime: true,
       webSearch: false, // No web search needed for deterministic responses
       businessMemory: false, // No business memory needed for deterministic responses
       timezone: effectiveTz,
       currentDateTime: current,
     };
     return {
       ok: true,
       data: { 
         id: null, 
         model: "deterministic", 
         message: cleanAITone(deterministicResponse, true), // Preserve facts for deterministic responses
         capabilities,
         insights: null
       },
     };
   }

   // WHOAMI CHECK (KEEP EXISTING FUNCTIONALITY)
   if (isWhoAmIIntent(parsed.data.message) && businessProfile) {
     const capabilities: ChatCoreCapabilities = {
       realtime: true,
       webSearch: true,
       businessMemory: true,
       timezone: effectiveTz,
       currentDateTime: current,
     };
     return {
       ok: true,
       data: { id: null, model: "profile", message: formatWhoAmIResponse(businessProfile), capabilities },
     };
   }

  const wantsItems3 = parsed.data.responseFormat === "items_3";
  const formatInstructions = wantsItems3
    ? [
        "Output format:",
        `Return exactly 3 proposals as strict JSON: {"items":["...","...","..."]}`,
        "No other keys. No text outside JSON.",
      ].join("\n")
    : [
        "Output format:",
        "SINGLE message (not multiple). Short mobile-style reply.",
        "ULTRA SHORT: 1-2 small sentences. Less is more.",
        "Examples of perfect length:",
        "  ✅ 'Oui. On en a encore.'",
        "  ✅ 'Ah d'accord. C'est bon.'",
        "  ✅ 'Demain, c'est OK.'",
        "Don't write paragraphs. Real humans in chat write short.",
        "Emotion > Grammar. Reaction > Explanation.",
      ].join("\n");

  // Detect emotional state and buying intent
  const prospectEmotion = detectProspectEmotion(parsed.data.message);
  const hasBuyingIntent = detectBuyingIntent(parsed.data.message);
  
  const emotionTone = {
    excited: "They’re excited. Match their energy. Enthusiastic, still brief.",
    hesitant: "They’re hesitant. Warm, reassuring, calm. Reduce pressure.",
    frustrated: "They’re frustrated. Professional, direct, solution-focused. Fix quickly.",
    joking: "They’re joking. Light humor, natural tone.",
    neutral: "They’re neutral. Direct and efficient. Clear communication.",
  }[prospectEmotion];

  const intentionTone = hasBuyingIntent
    ? "BUYING INTENT DETECTED: They’re interested. Be professional, confident, solution-focused. Guide to decision. No pressure, just smooth."
    : "";

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content: [
        SYSTEM_PROMPT,
        "",
        modeInstruction(mode),
        "",
        ANALYSIS_PROMPT,
        "",
        "SITUATIONAL STRATEGIES:",
        "Depending on your analysis, apply one of these guidelines:",
        JSON.stringify(STRATEGY_INSTRUCTIONS, null, 2),
        "",
        "SPECIALIZED MODULES:",
        "If OBJECTION_HANDLING is chosen $\rightarrow$ Use: \n" + OBJECTION_HANDLING_GUIDE,
        "If UPSELL is chosen $\rightarrow$ Use: \n" + UPSELL_GUIDELINES,
        "",
        "GUARDRAILS:",
        ANTI_AGGRESSIVE_RULES,
        "",
        `Current date/time (business local): ${current}.`,
        `Business local IANA timezone: ${effectiveTz}.`,
        `Client-reported timezone (fallback only): ${userTz}.`,
        [
          "GREETING / LOCAL TIME (business timezone above):",
          "- Use the business local clock as the reference for day vs evening.",
          "- If they say a specific phrase like “good afternoon”, keep it consistent — don’t snap to “good evening” unless blending naturally.",
          "- If their generic greeting mismatches local time, prefer the correct greeting without correcting them harshly (no “it’s not morning”).",
        ].join("\n"),
        businessProfileContext ? "" : null,
        businessProfileContext ? `Business profile context:\n${businessProfileContext}` : null,
        "",
        formatInstructions,
        "",
        "FINAL OUTPUT REQUIREMENT:",
        "You MUST return a strict JSON object containing both the analysis and the response:",
        `{
          "analysis": {
            "temperature": "Cold" | "Warm" | "Hot",
            "emotion": "Frustrated" | "Excited" | "Hesitant" | "Neutral" | "Joking" | "Skeptical",
            "trust": "Low" | "Medium" | "High",
            "intention": "Low" | "Medium" | "High",
            "activeObjections": ["PRICE" | "DELIVERY" | "TRUST" | "COMPETITION" | "QUALITY" | "NONE"],
            "conversationFatigue": 0.0-1.0,
            "conversionProbability": 0-100,
            "suggestedStrategy": "SOFT_CONVERSATION" | "PRODUCT_GUID_TIPS" | "TRUST_BUILDING" | "OBJECTION_HANDLING" | "SOFT_CLOSE" | "DIRECT_CLOSE" | "UPSELL" | "FOLLOWUP_WAIT" | "HUMAN_ESCALATION",
            "reasoning": "..."
          },
          "message": "The actual human-like response here"
        }`,
        "No text outside the JSON object. No markdown code blocks.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
    ...sanitizedHistory,
    { role: "user", content: parsed.data.message },
  ];

  console.log("[AI][MEMORY] PROMPT_CONTEXT_SENT", { hasBusinessContext: Boolean(businessProfileContext) });
  // Required for end-to-end memory audits: log the exact hidden system prompt sent to the model.
  console.log("[AI][PROMPT] SYSTEM_PROMPT", messages[0]?.content ?? "");

  async function callModel(model: AllowedModel) {
    const res = await openRouterChat({ model, messages, temperature: 0.4, timeoutMs: 25_000 });
    if (!res.ok) throw new Error(res.error);
    return res.data;
  }

  try {
    const result = await withRetries(async () => callModel(primaryModel), { retries: 1, baseDelayMs: 350 });

    const parsedAiResponse = safeJsonParse(result.message);
    let finalMessage = result.message;
    let insights: SupervisorInsights | null = null;

    if (parsedAiResponse && typeof parsedAiResponse === "object" && "message" in parsedAiResponse && "analysis" in parsedAiResponse) {
      finalMessage = String(parsedAiResponse.message);
      insights = {
        analysis: parsedAiResponse.analysis as ProspectAnalysis,
        activeStrategy: (parsedAiResponse.analysis as ProspectAnalysis).suggestedStrategy,
      };
    }

      const cleanedMessage = cleanAITone(finalMessage, false);
      // Apply anti-assumption guard and trust scoring to prevent inventing information and fake actions
      const guardContext = {
        businessProfile,
        hasVerifiedHours: false,   // We don't store hours in the business profile, so we don't know them
        hasVerifiedInfo: !!businessProfile, // We have the business profile, so we have some verified info
        userMessage: parsed.data.message
      };
      let guardedMessage = applyAntiAssumptionGuard(cleanedMessage, guardContext);
      
      // Calculate trust score and potentially regenerate if too low
      const trustScore = calculateTrustScore(guardedMessage, {
        businessProfile,
        hasVerifiedHours: false,
        hasVerifiedInfo: !!businessProfile,
        userAskedAboutHours: /heure|ouverture|fermeture|horaires/i.test(parsed.data.message),
        userAskedAboutInfo: [] // We don't have a way to break down specific info types, so leave empty
      });
      
      // If trust score is too low, use a safe human reply instead
      if (trustScore < 60) {
        // Determine what type of response would be appropriate
        if (/heure|ouverture|fermeture|horaires/i.test(parsed.data.message)) {
          guardedMessage = getHumanReply("unknownInfo");
        } else if (/merci|thank you/i.test(parsed.data.message)) {
          guardedMessage = getHumanReply("thanks");
        } else if (/bonjour|salut/i.test(parsed.data.message)) {
          guardedMessage = getHumanReply("greeting");
        } else if (/ok|d'accord/i.test(parsed.data.message)) {
          guardedMessage = getHumanReply("ok");
        } else if (/ça va|how are you/i.test(parsed.data.message)) {
          guardedMessage = getHumanReply("howAreYou");
        } else {
          guardedMessage = getHumanReply("cantHelp");
        }
      }
      
      const capabilities: ChatCoreCapabilities = {
        realtime: true,
        webSearch: true,
        businessMemory: Boolean(businessProfileContext),
        timezone: effectiveTz,
        currentDateTime: current,
      };
      return { ok: true, data: { ...result, message: guardedMessage, capabilities, insights } };
  } catch (err: unknown) {
    let lastMessage = err instanceof Error ? err.message : "Unknown error";
    for (const fm of fallbackModels) {
      try {
        const result = await withRetries(async () => callModel(fm), { retries: 1, baseDelayMs: 350 });
        const parsedAiResponse = safeJsonParse(result.message);
        let finalMessage = result.message;
        let insights: SupervisorInsights | null = null;

        if (parsedAiResponse && typeof parsedAiResponse === "object" && "message" in parsedAiResponse && "analysis" in parsedAiResponse) {
          finalMessage = String(parsedAiResponse.message);
          insights = {
            analysis: parsedAiResponse.analysis as ProspectAnalysis,
            activeStrategy: (parsedAiResponse.analysis as ProspectAnalysis).suggestedStrategy,
          };
        }

     let cleanedMessage = cleanAITone(finalMessage, false);
     // Apply anti-assumption guard to prevent inventing information
     cleanedMessage = applyAntiAssumptionGuard(cleanedMessage);
        const capabilities: ChatCoreCapabilities = {
          realtime: true,
          webSearch: true,
          businessMemory: Boolean(businessProfileContext),
          timezone: effectiveTz,
          currentDateTime: current,
        };
        return { ok: true, data: { ...result, message: cleanedMessage, capabilities, insights } };
      } catch (fallbackErr: unknown) {
        lastMessage = fallbackErr instanceof Error ? fallbackErr.message : lastMessage;
      }
    }
    return { ok: false, status: 502, error: lastMessage };
  }
}

export function extractItems3FromCoreMessage(coreMessage: string) {
  return splitToThreeItems(coreMessage);
}
