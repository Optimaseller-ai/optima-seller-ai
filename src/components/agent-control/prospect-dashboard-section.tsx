"use client";

import { MapPin, UserCircle2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ProspectProfileSnapshot } from "@/lib/agent-control-panel/snapshot-types";

import { formatDateTime } from "./display-utils";

function statusStyles(status: ProspectProfileSnapshot["status"]) {
  switch (status) {
    case "cold":
      return "bg-slate-100 text-slate-800 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800";
    case "warm":
      return "bg-amber-100 text-amber-950 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-900";
    case "hot":
      return "bg-orange-100 text-orange-950 ring-orange-200 dark:bg-orange-950 dark:text-orange-100 dark:ring-orange-900";
    case "ready":
      return "bg-emerald-100 text-emerald-950 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-900";
    default:
      return "bg-muted text-foreground ring-border";
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value ?? "—"}</p>
    </div>
  );
}

export function ProspectDashboardSection(props: { prospect: ProspectProfileSnapshot }) {
  const p = props.prospect;
  const scoreRaw = typeof p.salesScore === "number" && !Number.isNaN(p.salesScore) ? p.salesScore : 0;
  /** Bornes CSS uniquement (barre de progression). */
  const scoreBar = Math.min(100, Math.max(0, scoreRaw));

  return (
    <Card className="h-full border-black/[0.06] shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:shadow-none">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-black/[0.06] bg-muted/40">
              <UserCircle2 className="size-7 text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg leading-tight">{p.name}</CardTitle>
              <CardDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {p.id ? <span className="font-mono text-[11px]">#{p.id}</span> : null}
                {p.sessionId ? (
                  <span className="font-mono text-[11px] text-muted-foreground">session {p.sessionId}</span>
                ) : null}
              </CardDescription>
            </div>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
              statusStyles(p.status),
            )}
          >
            {p.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-end justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">Sales score</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">{scoreRaw}</p>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary shadow-[0_0_0_1px_rgba(22,163,74,0.15)]"
              style={{ width: `${scoreBar}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Valeur fournie par le backend (0–100).</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Téléphone" value={p.phone} />
          <Field label="Email" value={p.email} />
          <Field
            label="Localisation"
            value={
              p.city || p.country ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5 shrink-0 opacity-60" aria-hidden />
                  {[p.city, p.country].filter(Boolean).join(", ")}
                </span>
              ) : (
                "—"
              )
            }
          />
          <Field label="Langue" value={p.preferredLanguage?.toUpperCase()} />
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Intentions détectées</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {p.intents.length ? (
                p.intents.map((i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-border/80 bg-muted/40 px-2 py-1 text-xs font-medium text-foreground"
                  >
                    {i}
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted-foreground">—</li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Produits intéressés</p>
            <ul className="mt-2 space-y-1">
              {p.products.length ? (
                p.products.map((pr) => (
                  <li key={pr} className="text-sm leading-snug text-foreground">
                    {pr}
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted-foreground">—</li>
              )}
            </ul>
          </div>
        </div>

        {p.tags?.length ? (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tags</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <Separator />

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Historique résumé</p>
          <p className="text-sm leading-relaxed text-foreground">{p.historySummary}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Dernière activité</p>
            <p className="mt-1 text-sm font-medium">{formatDateTime(p.lastActivityAt)}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Prochaine action prévue</p>
            <p className="mt-1 text-sm font-medium leading-snug">{p.nextAction}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
