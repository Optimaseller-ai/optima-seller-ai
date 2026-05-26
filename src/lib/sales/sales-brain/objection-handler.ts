/**
 * Objections — réponses courtes naturelles (à injecter ou guider le modèle).
 * Entrée : extrait court issu de prospect-core.objections (pas tout le chat).
 */

import type { ProspectCoreProfile } from "@/lib/crm/prospect-core/prospect-profile";

export type ObjectionCategory = "price" | "trust" | "delivery" | "quality" | "time" | "unknown";

export function classifyObjectionSnippet(text: string): ObjectionCategory {
  const m = String(text ?? "").toLowerCase();
  if (/\b(prix|cher|budget|trop|économ|remise)\b/i.test(m)) return "price";
  if (/\b(confiance|arnaque|faux|original|garantie|vérifi)\b/i.test(m)) return "trust";
  if (/\b(livraison|délai|expéd|transport|douala|yaoundé)\b/i.test(m)) return "delivery";
  if (/\b(qualité|solide|frag|casse|durabilit)\b/i.test(m)) return "quality";
  if (/\b(temps|rush|vite|plus tard|demain|réfléchi)\b/i.test(m)) return "time";
  return "unknown";
}

/** Dernière objection connue dans le core. */
export function latestObjectionCategory(prospect: ProspectCoreProfile): ObjectionCategory {
  const last = prospect.objections[prospect.objections.length - 1];
  if (!last) return "unknown";
  return classifyObjectionSnippet(last);
}

export function objectionResponseHint(
  category: ObjectionCategory,
  lang: "fr" | "en" | "es",
  shippingCity?: string | null,
): string {
  if (lang === "en") {
    switch (category) {
      case "price":
        return "We also have a simpler version if budget is tight.";
      case "trust":
        return "Goods are checked before they go out — you’re covered.";
      case "delivery":
        return shippingCity
          ? `Fast delivery to ${shippingCity} when stock allows.`
          : "Fast delivery is available locally when stock allows.";
      case "quality":
        return "Best-sellers here are the ones buyers reorder — happy to compare.";
      case "time":
        return "No rush — tell me what timing works for you.";
      default:
        return "Tell me what’s blocking you — I’ll sort it.";
    }
  }
  if (lang === "es") {
    switch (category) {
      case "price":
        return "También tenemos una opción más accesible si el presupuesto aprieta.";
      case "trust":
        return "Se revisa antes de salir — va con garantía práctica.";
      case "delivery":
        return shippingCity
          ? `Entrega rápida a ${shippingCity} si hay stock.`
          : "Hay entrega rápida cuando hay stock disponible.";
      case "quality":
        return "Lo que más se repite es lo que la gente recomienda — te lo aclaro.";
      case "time":
        return "Sin presión — dime qué ritmo te encaja.";
      default:
        return "Dime qué te frena y lo resolvemos.";
    }
  }
  switch (category) {
    case "price":
      return "On a aussi une version plus abordable si le budget est serré.";
    case "trust":
      return "Le produit est vérifié avant envoi — pas de surprise.";
    case "delivery":
      return shippingCity
        ? `Livraison rapide dispo sur ${shippingCity} selon stock.`
        : "Livraison rapide dispo selon stock — je te confirme un créneau net.";
    case "quality":
      return "Les modèles qui repartent le plus sont ceux que les clients recommandent — je te montre.";
    case "time":
      return "Pas de stress — dis-moi juste quel délai t’arrange.";
    default:
      return "Dis-moi ce qui coince — on règle ça simplement.";
  }
}
