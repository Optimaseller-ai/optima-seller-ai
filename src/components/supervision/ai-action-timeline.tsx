"use client";

import {
  Mail,
  MessageCircle,
  Package,
  ShieldCheck,
  ShoppingCart,
  Workflow,
} from "lucide-react";

import type { SupervisionTimelineEntry } from "@/lib/supervision/supervision-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { formatSupervisionDt } from "./supervision-utils";

const KIND_META: Record<
  SupervisionTimelineEntry["kind"],
  { icon: typeof Mail; label: string }
> = {
  followup_sent: { icon: MessageCircle, label: "Relance" },
  email_generated: { icon: Mail, label: "Email" },
  workflow_n8n: { icon: Workflow, label: "n8n" },
  approval_requested: { icon: ShieldCheck, label: "Validation" },
  product_recommended: { icon: Package, label: "Produit" },
  cart_abandoned: { icon: ShoppingCart, label: "Abandon" },
  message: { icon: MessageCircle, label: "Message" },
  intent: { icon: MessageCircle, label: "Intention" },
  agent_action: { icon: Workflow, label: "Action agent" },
};

export function AiActionTimeline(props: { entries: SupervisionTimelineEntry[]; emptyHint?: string }) {
  return (
    <Card className="border-black/[0.06] shadow-sm dark:shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Timeline actions IA</CardTitle>
        <CardDescription>Relances, workflows, validations et recommandations.</CardDescription>
      </CardHeader>
      <CardContent>
        {props.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{props.emptyHint ?? "Sélectionnez une conversation."}</p>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-4">
            {props.entries.map((e) => {
              const meta = KIND_META[e.kind] ?? KIND_META.message;
              const Icon = meta.icon;
              return (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[1.35rem] top-1 flex size-5 items-center justify-center rounded-full border bg-background">
                    <Icon className="size-3 text-primary" aria-hidden />
                  </span>
                  <p className="text-sm font-medium">{e.label}</p>
                  <p className="text-[10px] text-muted-foreground">{formatSupervisionDt(e.at)}</p>
                  {e.detail ? <p className="mt-1 text-xs text-muted-foreground">{e.detail}</p> : null}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
