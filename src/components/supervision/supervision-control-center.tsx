"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import type {
  SupervisionControlCenterPayload,
  SupervisionConversationDetail,
} from "@/lib/supervision/supervision-types";
import type { ConversationTakeoverMode } from "@/lib/supervision/conversation-takeover";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

import { AiActionTimeline } from "./ai-action-timeline";
import { DecisionExplainer } from "./decision-explainer";
import { PipelineDebugPanel } from "./pipeline-debug-panel";
import { HotProspectPanel } from "./hot-prospect-panel";
import { LiveAgentStatus } from "./live-agent-status";
import { LiveConversationFeed } from "./live-conversation-feed";
import { ProspectIntelligencePanel } from "./prospect-intelligence-panel";
import { SupervisionAnalyticsStrip } from "./supervision-analytics-strip";
import { BusinessLearningInsights } from "./business-learning-insights";
import { SupervisionAutomationHub } from "./supervision-automation-hub";
import { formatSupervisionDt } from "./supervision-utils";

const POLL_MS = 5000;

export function SupervisionControlCenter() {
  const { toast } = useToast();
  const [payload, setPayload] = React.useState<SupervisionControlCenterPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<SupervisionConversationDetail | null>(null);
  const [takeoverLoading, setTakeoverLoading] = React.useState(false);

  const loadFeed = React.useCallback(async () => {
    try {
      const res = await fetch("/api/supervision/feed", { credentials: "include", cache: "no-store" });
      const js = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "destructive", title: "Supervision", description: String(js?.error ?? res.statusText) });
        return;
      }
      setPayload(js as SupervisionControlCenterPayload);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadDetail = React.useCallback(async (id: string) => {
    const res = await fetch(`/api/supervision/conversation/${encodeURIComponent(id)}`, {
      credentials: "include",
      cache: "no-store",
    });
    const js = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDetail(null);
      return;
    }
    setDetail((js as { conversation: SupervisionConversationDetail }).conversation);
  }, []);

  React.useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  React.useEffect(() => {
    const t = window.setInterval(() => void loadFeed(), POLL_MS);
    return () => window.clearInterval(t);
  }, [loadFeed]);

  React.useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  async function setTakeover(mode: ConversationTakeoverMode) {
    if (!selectedId) return;
    setTakeoverLoading(true);
    try {
      const res = await fetch("/api/supervision/takeover", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId, mode }),
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "destructive", title: "Reprise", description: String(js?.error ?? res.statusText) });
        return;
      }
      toast({ title: "Mode mis à jour", description: mode });
      await loadDetail(selectedId);
      await loadFeed();
    } finally {
      setTakeoverLoading(false);
    }
  }

  const conversationAlerts = payload?.alerts.filter((a) => !a.id.startsWith("alert_")) ?? payload?.alerts ?? [];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Optima Seller AI</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Supervision</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Suivez vos commerciaux intelligents — conversations, relances et validations, sans complexité.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadFeed()} disabled={loading}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
          Actualiser
        </Button>
      </header>

      {payload ? <SupervisionAnalyticsStrip analytics={payload.analytics} /> : null}

      {conversationAlerts.length > 0 ? (
        <ul className="space-y-2">
          {conversationAlerts.slice(0, 3).map((a) => (
            <li
              key={a.id}
              className={cn(
                "flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm",
                a.severity === "critical" && "border-red-200 bg-red-50/80 dark:bg-red-950/30",
                a.severity === "warning" && "border-amber-200 bg-amber-50/60 dark:bg-amber-950/20",
                a.severity === "info" && "border-border bg-muted/30",
              )}
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.body}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {payload ? <LiveAgentStatus agent={payload.agent} updatedAt={formatSupervisionDt(payload.updatedAt)} /> : null}

      <BusinessLearningInsights />

      {payload?.automation ? (
        <SupervisionAutomationHub
          hub={payload.automation}
          onRefresh={() => void loadFeed()}
          onSelectConversation={(id) => {
            setSelectedId(id);
            document.getElementById("conversations")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      ) : null}

      <div id="conversations" className="grid gap-6 scroll-mt-24 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
          {payload ? (
            <LiveConversationFeed
              items={payload.feed}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
            />
          ) : null}
          {detail ? (
            <>
              <TakeoverBar mode={detail.takeoverMode} loading={takeoverLoading} onSet={setTakeover} />
              <ProspectIntelligencePanel prospect={detail.prospect} prospectName={detail.agentName} />
              <DecisionExplainer decisions={detail.decisions} />
              <PipelineDebugPanel debug={detail.pipelineDebug} />
              <AiActionTimeline entries={detail.timeline} />
            </>
          ) : (
            <AiActionTimeline
              entries={[]}
              emptyHint="Choisissez une conversation pour voir ce que l’agent a fait sur ce fil."
            />
          )}
        </div>

        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          {payload ? (
            <HotProspectPanel
              items={payload.hotProspects}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TakeoverBar(props: {
  mode: ConversationTakeoverMode;
  loading: boolean;
  onSet: (m: ConversationTakeoverMode) => void;
}) {
  const modes: { id: ConversationTakeoverMode; label: string }[] = [
    { id: "AI_ACTIVE", label: "IA active" },
    { id: "HUMAN_ACTIVE", label: "Humain" },
    { id: "HYBRID", label: "Hybride" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.04] p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reprise conversation</p>
      {modes.map((m) => (
        <Button
          key={m.id}
          type="button"
          size="sm"
          variant={props.mode === m.id ? "default" : "outline"}
          disabled={props.loading}
          onClick={() => props.onSet(m.id)}
        >
          {m.label}
        </Button>
      ))}
    </div>
  );
}
