import "server-only";

import { isStrongNegativeEmotionalTurn } from "./emotions/conversation-emotion";
import { norm } from "@/lib/agents/seller-language";

/** Réponses « secrétaire / ticket » à éviter en sortie (insensible à la casse). */
const COLD_ACK_WHOLE_LINE = /^(bien\s+reçu|bien\s+recu|noté|c'est\s+noté|c\s*est\s+noté|compris|d'accord|dac|ok|okay)\.?$/i;

const GENERIC_HELP_FR =
  /^(que\s+puis-je\s+faire\s+pour\s+vous|comment\s+puis-je\s+vous\s+aider|comment\s+puis-je\s+t['’]aider|en\s+quoi\s+puis-je)/i;
const GENERIC_HELP_EN = /^(how\s+can\s+i\s+help|what\s+can\s+i\s+do\s+for\s+you|how\s+may\s+i\s+help)/i;

function looksFr(text: string) {
  return /\b(bonjour|monsieur|madame|merci|vous|chez)\b/i.test(text);
}

/** Prospect reproche des erreurs / qualité à l’interlocuteur. */
export function prospectCriticizesAgentOrQuality(userMessage: string): boolean {
  const t = norm(userMessage).toLowerCase();
  if (!t) return false;
  return (
    /\b(trop\s+d['’']?erreurs|beaucoup\s+d['’']?erreurs|vous\s+vous\s+trompez|tu\s+te\s+trompes|tu\s+fais\s+(trop\s+)?d['’']?erreurs|vous\s+faites\s+(trop\s+)?d['’']?erreurs|vous\s+avez\s+tor|tu\s+as\s+tor|n['’']?importe\s+quoi|incohérent|robot|ia\b|chatgpt)/i.test(
      t,
    ) || /\b(you\s+keep\s+making\s+mistakes|you\s+are\s+wrong|too\s+many\s+mistakes)\b/i.test(t)
  );
}

function replyAcknowledgesFriction(reply: string): boolean {
  const r = norm(reply).toLowerCase();
  if (!r) return false;
  return (
    /\b(je\s+comprends|vous\s+avez\s+raison|vous\s+avez\s+totalement\s+raison|merci\s+pour|pardon|désol|désolée|excuse|je\s+vais\s+être\s+plus\s+précis|je\s+serai\s+plus\s+précis|je\s+me\s+suis\s+tromp|je\s+corrige|noté\s+pour\s+la\s+précision|fair\s+enough|you('?re)?\s+right|my\s+mistake|sorry)\b/i.test(
      r,
    )
  );
}

export type HumanAdvisorFilterResult = {
  text: string;
  wasRepaired: boolean;
  reason?: "cold_ack" | "ignored_agent_criticism" | "generic_help_shell";
};

/**
 * « Est-ce qu’un vrai conseiller humain répondrait ainsi ? » — corrections heuristiques
 * (pas de second appel LLM : garde latence et coût maîtrisés).
 */
export function filterAdvisorReplyHumanLikeness(args: {
  reply: string;
  lastUserMessage: string;
}): HumanAdvisorFilterResult {
  let text = String(args.reply ?? "").trim();
  const user = String(args.lastUserMessage ?? "").trim();
  if (!text) return { text, wasRepaired: false };

  const fr = looksFr(text) || looksFr(user);

  if (COLD_ACK_WHOLE_LINE.test(norm(text))) {
    const repair = isStrongNegativeEmotionalTurn(user)
      ? fr
        ? "D’accord."
        : "Alright."
      : fr
        ? "Je vous écoute."
        : "Tell me what you need — I’m listening.";
    return { text: repair, wasRepaired: true, reason: "cold_ack" };
  }

  if (prospectCriticizesAgentOrQuality(user) && !replyAcknowledgesFriction(text)) {
    if (GENERIC_HELP_FR.test(norm(text)) || GENERIC_HELP_EN.test(norm(text))) {
      const prefix = fr ? "Vous avez raison. " : "You’re right. ";
      const stripped = norm(text).replace(GENERIC_HELP_FR, "").replace(GENERIC_HELP_EN, "").replace(/^[.?\s]+/, "");
      text = prefix + (stripped || (fr ? "Je vais être plus précis." : "I’ll be more precise."));
      return { text, wasRepaired: true, reason: "ignored_agent_criticism" };
    }
    if (!replyAcknowledgesFriction(text)) {
      const prefix = fr ? "Vous avez raison. " : "You’re right. ";
      return { text: prefix + text, wasRepaired: true, reason: "ignored_agent_criticism" };
    }
  }

  if ((GENERIC_HELP_FR.test(norm(text)) || GENERIC_HELP_EN.test(norm(text))) && user.length >= 12) {
    const substantive = /\b(prix|stock|livraison|dispo|modèle|command|pay|fcfa|€|eur|article|phone|téléphone)\b/i.test(
      user.toLowerCase(),
    );
    if (substantive && text.length < 80) {
      const prefix = fr ? "Pour votre demande : " : "On your question: ";
      return { text: prefix + text, wasRepaired: true, reason: "generic_help_shell" };
    }
  }

  return { text, wasRepaired: false };
}
