"use client";

import * as React from "react";
import {
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  Workflow,
} from "lucide-react";

import type {
  AutomationJobDetailDTO,
  AutomationPendingItemDTO,
} from "@/lib/automation/supervision-dto-types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

const POLL_MS = 4000;

type PendingResponse = {
  awaitingHumanTotal: number;
  returnedCount: number;
  queueDepth: {
    pending: number;
    scheduled: number;
    executing: number;
    retrying: number;
    awaitingHuman: number;
    blocked: number;
    autoExecuted: number;
    softExecuted: number;
    completed: number;
    failed: number;
  };
  items: AutomationPendingItemDTO[];
};

function actionKindBadge(kind: AutomationPendingItemDTO["actionKindUi"]) {
  switch (kind) {
    case "email":
      return {
        icon: Mail,
        label: "Email",
        className: "bg-sky-100 text-sky-950 ring-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:ring-sky-900",
      };
    case "whatsapp":
      return {
        icon: MessageCircle,
        label: "WhatsApp",
        className: "bg-emerald-100 text-emerald-950 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-900",
      };
    default:
      return {
        icon: Workflow,
        label: "n8n",
        className:
          "bg-violet-100 text-violet-950 ring-violet-200 dark:bg-violet-950 dark:text-violet-100 dark:ring-violet-900",
      };
  }
}

function formatDt(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AutomationSupervisionClient() {
  const { toast } = useToast();
  const [list, setList] = React.useState<AutomationPendingItemDTO[]>([]);
  const [totals, setTotals] = React.useState<{
    awaiting: number;
    pending: number;
    scheduled: number;
    executing: number;
    retrying: number;
    blocked: number;
    autoExecuted: number;
    softExecuted: number;
  } | null>(null);
  const [loadingList, setLoadingList] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<AutomationJobDetailDTO | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [actingId, setActingId] = React.useState<string | null>(null);

  const loadList = React.useCallback(async () => {
    try {
      const res = await fetch("/api/automation/pending", { credentials: "include", cache: "no-store" });
      const js = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "destructive", title: "Liste indisponible", description: String(js?.error ?? res.statusText) });
        return;
      }
      const payload = js as PendingResponse;
      setList(payload.items ?? []);
      setTotals({
        awaiting: payload.awaitingHumanTotal ?? 0,
        pending: payload.queueDepth?.pending ?? 0,
        scheduled: payload.queueDepth?.scheduled ?? 0,
        executing: payload.queueDepth?.executing ?? 0,
        retrying: payload.queueDepth?.retrying ?? 0,
        blocked: payload.queueDepth?.blocked ?? 0,
        autoExecuted: payload.queueDepth?.autoExecuted ?? 0,
        softExecuted: payload.queueDepth?.softExecuted ?? 0,
      });
    } finally {
      setLoadingList(false);
    }
  }, [toast]);

  const loadDetail = React.useCallback(
    async (id: string) => {
      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/automation/detail/${encodeURIComponent(id)}`, {
          credentials: "include",
          cache: "no-store",
        });
        const js = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast({ variant: "destructive", title: "Détail", description: String(js?.error ?? res.statusText) });
          setDetail(null);
          return;
        }
        setDetail(js.job as AutomationJobDetailDTO);
      } finally {
        setLoadingDetail(false);
      }
    },
    [toast],
  );

  React.useEffect(() => {
    void loadList();
  }, [loadList]);

  React.useEffect(() => {
    const t = window.setInterval(() => {
      void loadList();
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [loadList]);

  React.useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  async function postAction(path: string, jobId: string) {
    setActingId(jobId);
    try {
      const res = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "destructive", title: "Action refusée", description: String(js?.error ?? res.statusText) });
        return;
      }
      if (path.endsWith("/approve")) {
        const ok = Boolean(js.n8nDispatched);
        toast({
          title: ok ? "Validé — webhook n8n envoyé" : "Validé — échec partiel n8n",
          description: ok
            ? "La job a été traitée."
            : "La job est repassée en file pour retry automatique côté serveur.",
        });
      } else if (path.endsWith("/reject")) {
        toast({ title: "Action rejetée", description: "La job est annulée." });
      } else {
        toast({
          title: "Remise en file",
          description: "La job est en attente de traitement (sans envoi n8n immédiat).",
        });
      }
      setSelectedId(null);
      setDetail(null);
      await loadList();
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Supervision</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">File automation — validation humaine</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Actions générées par l’agent et mises en pause tant qu’un administrateur ne valide pas. Actualisation toutes
            les {POLL_MS / 1000}s.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadList()} disabled={loadingList}>
            <RefreshCw className={cn("size-4", loadingList && "animate-spin")} aria-hidden />
            Rafraîchir
          </Button>
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2 text-right text-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">En attente humain</p>
            <p className="text-lg font-semibold tabular-nums">{totals?.awaiting ?? "—"}</p>
            {totals != null ? (
              <p className="text-[11px] text-muted-foreground">
                sched. {totals.scheduled ?? 0} · exec {totals.executing ?? 0} · retry {totals.retrying ?? 0} · pending{" "}
                {totals.pending}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Card className="border-black/[0.06] shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Actions en attente</CardTitle>
            <CardDescription>Sélectionnez une ligne pour afficher le détail complet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingList && !list.length ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Chargement…
              </div>
            ) : null}
            {!loadingList && list.length === 0 ? (
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                Aucune action en attente de validation. Les nouvelles intentions apparaîtront ici automatiquement.
              </div>
            ) : null}

            <ul className="space-y-2">
              {list.map((item) => {
                const meta = actionKindBadge(item.actionKindUi);
                const Icon = meta.icon;
                const active = selectedId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        "w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none",
                        active
                          ? "border-primary/40 bg-primary/[0.06] ring-2 ring-primary/20"
                          : "border-black/[0.06] bg-white/80 dark:bg-card",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                              meta.className,
                            )}
                          >
                            <Icon className="size-3.5" aria-hidden />
                            {meta.label}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {item.prospect.name?.trim() || "Prospect"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{formatDt(item.createdAt)}</p>
                          </div>
                        </div>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                          {item.intentPriority ?? "—"} · score {item.priorityScore ?? "—"}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.previewMessage}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={actingId === item.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void postAction("/api/automation/approve", item.id);
                          }}
                        >
                          {actingId === item.id ? (
                            <>
                              <Loader2 className="size-4 animate-spin" aria-hidden />
                              Envoi…
                            </>
                          ) : (
                            "Valider"
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={actingId === item.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void postAction("/api/automation/modify", item.id);
                          }}
                        >
                          Modifier
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={actingId === item.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void postAction("/api/automation/reject", item.id);
                          }}
                        >
                          Rejeter
                        </Button>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-28 lg:self-start">
          <Card className="border-black/[0.06] shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:shadow-none">
            <CardHeader>
              <CardTitle className="text-lg">Détail & intention</CardTitle>
              <CardDescription>Données telles que stockées sur la job automation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {!selectedId ? (
                <p className="text-muted-foreground">Sélectionnez une action à gauche.</p>
              ) : loadingDetail ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Chargement du détail…
                </div>
              ) : detail ? (
                <>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Statut cycle</p>
                    <p className="mt-0.5 font-mono text-xs">{detail.lifecycleStatus}</p>
                  </div>
                  {detail.priorityScore != null ? (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Score priorité lead
                      </p>
                      <p className="mt-0.5 text-xs font-medium">
                        {detail.priorityScore}
                        {detail.priorityBand ? (
                          <span className="ms-2 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                            {detail.priorityBand}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  ) : null}
                  <Separator />
                  <div className="grid gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Prospect</p>
                    <p className="font-medium">{detail.prospect.name ?? "—"}</p>
                    <p className="text-muted-foreground">{detail.prospect.email ?? "—"}</p>
                    <p className="text-muted-foreground">{detail.prospect.phone ?? "—"}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Intent / rationale
                    </p>
                    <p className="mt-1 text-foreground">{detail.intentActionType ?? detail.event}</p>
                    <p className="mt-1 text-muted-foreground">{detail.intentRationale ?? "—"}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-md bg-muted px-2 py-0.5">workflow {detail.suggestedWorkflow ?? "—"}</span>
                      <span className="rounded-md bg-muted px-2 py-0.5">priorité {detail.intentPriority ?? "—"}</span>
                      <span className="rounded-md bg-muted px-2 py-0.5">confiance {detail.intentConfidence ?? "—"}</span>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Messages</p>
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-xs leading-relaxed">
                      <span className="font-semibold text-foreground">Dernier message utilisateur</span>
                      {"\n"}
                      {detail.lastUserMessage || "—"}
                    </p>
                    {detail.lastAssistantReply ? (
                      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/25 p-3 text-xs leading-relaxed text-muted-foreground">
                        <span className="font-semibold text-foreground">Réponse assistant</span>
                        {"\n"}
                        {detail.lastAssistantReply}
                      </p>
                    ) : null}
                  </div>
                  <Separator />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Journal récent</p>
                    <ul className="mt-2 max-h-40 space-y-1 overflow-auto font-mono text-[10px] text-muted-foreground">
                      {[...detail.logTrail].reverse().map((line, i) => {
                        const origIdx = detail.logTrail.length - 1 - i;
                        return (
                          <li key={`${detail.id}-log-${origIdx}`}>{line}</li>
                        );
                      })}
                    </ul>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Impossible de charger ce détail.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
