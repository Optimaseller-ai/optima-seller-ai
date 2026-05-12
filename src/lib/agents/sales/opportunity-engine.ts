import type { CommercialMemory, ConversationProfile, ProductMemory, SellerIntent } from "@/lib/agents/memory/conversation-state";
import { buildCrossSellSuggestions } from "@/lib/agents/sales/cross-sell-suggestions";

export type ClosingLevel = "soft" | "medium" | "direct";

export type HesitationFear = "price" | "quality" | "delivery" | "trust";

function detectHesitationFears(text: string): HesitationFear[] {
  const t = String(text ?? "").toLowerCase();
  const out = new Set<HesitationFear>();
  if (/\b(trop cher|cher|budget|pas le budget|pas assez|€|fcfa|cfa|prix|économ|moins cher)\b/i.test(t)) out.add("price");
  if (/\b(qualité|fiable|garantie|original|copie|vrai ou faux|cassee|casse)\b/i.test(t)) out.add("quality");
  if (/\b(livraison|délai|expédition|perdu|colis|transport|arriv)\b/i.test(t)) out.add("delivery");
  if (/\b(confiance|arnaque|serieux|sérieux|première fois|inquiet)\b/i.test(t)) out.add("trust");
  return [...out];
}

function userTurnCount(history: Array<{ role: string; content: string }>) {
  return history.filter((m) => m.role === "user").length;
}

export function pickClosingLevel(args: {
  profile?: ConversationProfile;
  intent?: SellerIntent;
  userTurns: number;
}): ClosingLevel {
  const bi = args.profile?.buyingIntent ?? 35;
  const hot = args.profile?.interestLevel === "hot" || args.intent === "purchase_intent";
  if (hot && bi >= 72) return "direct";
  if (bi >= 48 || args.intent === "price_inquiry" || args.intent === "stock_inquiry" || args.userTurns >= 4) return "medium";
  return "soft";
}

export type SalesOpportunityResult = {
  closingLevel: ClosingLevel;
  hesitationFears: HesitationFear[];
  promptBlockFr: string;
  promptBlockEn: string;
};

/**
 * Analyse contexte + catalogue pour orienter le modèle (vente active, sans agressivité).
 */
export function runSalesOpportunityEngine(args: {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  conversationProfile?: ConversationProfile;
  productMemory?: ProductMemory;
  commercialMemory?: CommercialMemory;
  lastIntent?: SellerIntent;
  productsText: string;
}): SalesOpportunityResult {
  const recent = [...(args.history ?? [])]
    .slice(-6)
    .map((m) => m.content)
    .join(" ");
  const blob = `${recent} ${args.message}`.toLowerCase();
  const fears = detectHesitationFears(blob);
  const userTurns = userTurnCount(args.history ?? []);
  const closingLevel = pickClosingLevel({
    profile: args.conversationProfile,
    intent: args.lastIntent,
    userTurns,
  });

  const cross = buildCrossSellSuggestions({ userText: args.message, catalogBlob: args.productsText });

  const linesFr: string[] = [];
  linesFr.push("MODE « COMMERCIAL ACTIF » (excellent vendeur humain):");
  linesFr.push("- Ne pas seulement répondre: vendez, engagez, orientez, proposez, faites avancer (réservation, commande, livraison, paiement, rappel) — toujours avec naturel.");
  linesFr.push("- Prendre l’initiative: si le prospect dit juste « bonjour », proposer une ouverture utile (ex. orienter budget / famille de produits / dispo), une seule question max ou une proposition courte.");
  linesFr.push("- Interdit: « comment puis-je vous aider », ton assistant, pression, spam.");
  linesFr.push("");
  linesFr.push(`Niveau de closing conseillé pour ce tour: **${closingLevel}**.`);
  if (closingLevel === "soft")
    linesFr.push('Exemples d’esprit (ne pas copier): proposer une réservation douce — « Souhaitez-vous que je vous réserve cela ? »');
  if (closingLevel === "medium")
    linesFr.push('Exemples d’esprit: « Je peux vous envoyer les détails livraison. » / prochaine étape concrète.');
  if (closingLevel === "direct")
    linesFr.push('Exemples d’esprit: « Je peux valider votre commande maintenant si vous voulez. » — seulement si le prospect est chaud / intention achat forte.');
  linesFr.push("");
  linesFr.push("MODE CONSEILLER: si budget ou usage connu, recommander UN modèle du catalogue qui colle (pas d’invention).");
  linesFr.push("URGENCE HUMAINE (très subtile, 0 ou 1 fois): stock limité / demande forte — seulement si cohérent avec infos catalogue, jamais exagéré.");
  linesFr.push("VENTE CROISÉE: si pertinent, une phrase naturelle (« nous avons aussi… ») — jamais agressif.");

  if (fears.length) {
    linesFr.push("");
    linesFr.push(`Hésitations détectées (${fears.join(", ")}): rassurer avec faits sobres (contrôle qualité, livraison suivie, retours selon politique réelle si dans docs) — pas de promesse inventée.`);
    linesFr.push('Exemples d’esprit: « Plusieurs clients prennent ce modèle actuellement. » / « Nous vérifions les envois avant expédition. »');
  }

  if (args.commercialMemory?.objections?.length) {
    linesFr.push("");
    linesFr.push("Objections mémorisées (ne pas répéter mot pour mot, tenir compte):");
    args.commercialMemory.objections.slice(0, 3).forEach((o) => linesFr.push(`- ${o}`));
  }
  if (args.commercialMemory?.likedProducts?.length) {
    linesFr.push("");
    linesFr.push("Intérêts positifs mémorisés:");
    args.commercialMemory.likedProducts.slice(0, 3).forEach((o) => linesFr.push(`- ${o}`));
  }

  if (cross.length) {
    linesFr.push("");
    linesFr.push("Pistes vente croisée (catalogue):");
    cross.forEach((c) => linesFr.push(`- ${c}`));
  }

  const linesEn: string[] = [];
  linesEn.push("ACTIVE SALES MODE (top human salesperson):");
  linesEn.push("- Don’t only answer: sell, steer, propose, move forward (hold, order, delivery, payment) — always natural, never pushy.");
  linesEn.push("- Take initiative on bare greetings: offer useful direction (budget / category / availability), at most one question.");
  linesEn.push("- Banned: “how can I help”, assistant tone, spam, fake urgency.");
  linesEn.push("");
  linesEn.push(`Suggested closing strength this turn: **${closingLevel}**.`);
  if (fears.length) {
    linesEn.push("");
    linesEn.push(`Hesitation signals: ${fears.join(", ")} — reassure with facts from catalogue/docs only.`);
  }
  if (cross.length) {
    linesEn.push("");
    linesEn.push("Cross-sell hints:");
    cross.forEach((c) => linesEn.push(`- ${c}`));
  }

  return {
    closingLevel,
    hesitationFears: fears,
    promptBlockFr: linesFr.join("\n"),
    promptBlockEn: linesEn.join("\n"),
  };
}
