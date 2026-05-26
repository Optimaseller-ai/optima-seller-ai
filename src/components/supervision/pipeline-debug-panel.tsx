"use client";

import { Bug } from "lucide-react";

import type { ConversationPipelineRuntimeSnapshot } from "@/lib/chat/pipeline/pipeline-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PipelineDebugPanel(props: { debug?: ConversationPipelineRuntimeSnapshot | null }) {
  const d = props.debug;
  if (!d) return null;

  return (
    <Card className="border-dashed border-muted-foreground/30 bg-muted/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Bug className="size-3.5" aria-hidden />
          Pipeline (debug)
        </CardTitle>
        <CardDescription className="text-xs">
          Dernier tour — {d.totalMs} ms · {d.responseMode}
          {d.hadDegradations ? " · dégradations" : ""}
          {d.hadErrors ? " · erreurs fatales" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-xs text-muted-foreground">
        <Row label="Moteurs actifs" value={d.activeEngines.join(", ") || "—"} />
        <Row label="Signal social" value={d.socialSignal ?? "—"} />
        <Row label="Émotion" value={d.detectedEmotion ?? "—"} />
        <Row label="Stratégie" value={d.selectedStrategy ?? "—"} />
        <Row label="Fallback" value={d.fallbackKind === "none" ? "aucun" : `${d.fallbackKind}${d.fallbackReason ? ` (${d.fallbackReason})` : ""}`} />
        <Row label="Automation" value={d.automationTriggered ? "oui" : "non"} />
        <Row label="Mode social seul" value={d.socialOnlyMode ? "oui" : "non"} />
        <Row label="Bloc automation" value={d.automationBlockReason ?? "—"} />
        <Row label="Classification lead" value={d.leadClassificationReason ?? "—"} />
        {d.replyTransformationChain && d.replyTransformationChain.length > 0 ? (
          <div className="mt-1 max-h-28 overflow-y-auto rounded-lg border border-border/50 bg-background/60 p-2">
            <p className="mb-1 text-[10px] font-medium text-foreground/80">Chaîne réponse</p>
            {d.replyTransformationChain.map((t, i) => (
              <p key={i} className="font-mono text-[10px] leading-relaxed">
                {t.step} {t.beforeLen}→{t.afterLen} ({t.delta >= 0 ? "+" : ""}
                {t.delta}) {t.reason}
              </p>
            ))}
          </div>
        ) : null}
        {d.steps.length > 0 ? (
          <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-border/50 bg-background/60 p-2">
            {d.steps.slice(-8).map((s, i) => (
              <p key={i} className="font-mono text-[10px] leading-relaxed">
                {s.step}/{s.engine} {s.status} {s.ms}ms
                {s.fallbackReason ? ` · ${s.fallbackReason}` : ""}
              </p>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row(props: { label: string; value: string }) {
  return (
    <p>
      <span className="text-foreground/70">{props.label} :</span> {props.value}
    </p>
  );
}
