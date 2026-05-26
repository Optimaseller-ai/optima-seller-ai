/** Formatage d’affichage uniquement — pas de règles métier. */

export function formatDateTime(iso: string, locale = "fr-FR") {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
