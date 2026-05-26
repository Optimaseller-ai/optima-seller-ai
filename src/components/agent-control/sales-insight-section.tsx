"use client";

import { Activity, AlertCircle, Brain, Flame, MessageSquareWarning, Route, ShieldCheck, Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SalesInsightSnapshot } from "@/lib/agent-control-panel/snapshot-types";

function Row({ icon: Icon, label, value }: { icon: typeof Brain; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-black/[0.05] bg-white/60 p-3 dark:bg-white/[0.03]">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-muted/30">
        <Icon className="size-4 text-primary" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function SalesInsightSection(props: { insight: SalesInsightSnapshot }) {
  const i = props.insight;
  return (
    <Card className="h-full border-black/[0.06] shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:shadow-none">
      <CardHeader>
        <CardTitle className="text-lg">Sales brain — insights</CardTitle>
        <CardDescription>Stratégie et décision telle que renvoyée par le backend.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Row icon={Route} label="Stratégie choisie" value={i.strategy} />
        <Row icon={MessageSquareWarning} label="Objection détectée" value={i.objection} />
        <Row icon={Brain} label="Raison de décision" value={i.decisionReason} />
        <Row icon={Flame} label="Niveau d’urgence" value={i.urgencyLevel} />
        <Row icon={Sparkles} label="Recommandation suivante" value={i.nextRecommendation} />
        {i.dominantEmotion ? (
          <Row icon={Brain} label="Émotion dominante" value={i.dominantEmotion} />
        ) : null}
        {i.trustLevel ? <Row icon={ShieldCheck} label="Niveau confiance" value={i.trustLevel} /> : null}
        {i.abandonmentRisk ? (
          <Row icon={AlertCircle} label="Risque abandon" value={i.abandonmentRisk} />
        ) : null}
        {i.relationalQuality ? (
          <Row icon={Activity} label="Qualité relationnelle" value={i.relationalQuality} />
        ) : null}
        {i.emotionalState ? (
          <Row icon={MessageSquareWarning} label="État émotionnel" value={i.emotionalState} />
        ) : null}
        {i.activePersonality ? (
          <Row icon={Route} label="Personnalité active" value={i.activePersonality} />
        ) : null}
        {i.personalityConsistency ? (
          <Row icon={Activity} label="Cohérence personnalité" value={i.personalityConsistency} />
        ) : null}
        {i.humanizationQuality ? (
          <Row icon={Sparkles} label="Qualité humanisation" value={i.humanizationQuality} />
        ) : null}
        {i.emotionalStability ? (
          <Row icon={ShieldCheck} label="Stabilité émotionnelle" value={i.emotionalStability} />
        ) : null}
      </CardContent>
    </Card>
  );
}
