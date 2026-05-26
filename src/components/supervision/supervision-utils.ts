export function formatSupervisionDt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function temperatureTone(t?: string): string {
  if (t === "ready" || t === "hot") return "text-orange-700 dark:text-orange-400";
  if (t === "warm") return "text-amber-700 dark:text-amber-400";
  return "text-muted-foreground";
}
