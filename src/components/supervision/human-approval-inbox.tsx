"use client";

import * as React from "react";
import { Loader2, Mail, MessageCircle, Workflow } from "lucide-react";

import type { AutomationPendingItemDTO } from "@/lib/automation/supervision-dto-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

import { formatSupervisionDt } from "./supervision-utils";

function actionKindBadge(kind: AutomationPendingItemDTO["actionKindUi"]) {
  switch (kind) {
    case "email":
      return { icon: Mail, label: "Email", className: "bg-sky-100 text-sky-950 ring-sky-200 dark:bg-sky-950 dark:text-sky-100" };
    case "whatsapp":
      return {
        icon: MessageCircle,
        label: "WhatsApp",
        className: "bg-emerald-100 text-emerald-950 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-100",
      };
    default:
      return {
        icon: Workflow,
        label: "n8n",
        className: "bg-violet-100 text-violet-950 ring-violet-200 dark:bg-violet-950 dark:text-violet-100",
      };
  }
}

export function HumanApprovalInbox(props: {
  items: AutomationPendingItemDTO[];
  onRefresh?: () => void;
}) {
  const { toast } = useToast();
  const [actingId, setActingId] = React.useState<string | null>(null);

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
      toast({
        title: path.endsWith("/approve") ? "Validé" : path.endsWith("/reject") ? "Refusé" : "Remis en file",
        description: path.endsWith("/approve") && js.n8nDispatched ? "Webhook n8n envoyé." : undefined,
      });
      props.onRefresh?.();
    } finally {
      setActingId(null);
    }
  }

  return (
    <Card className="border-black/[0.06] shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Validations humaines</CardTitle>
        <CardDescription>Emails, commandes sensibles, remises — Valider · Modifier · Refuser.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[360px] overflow-y-auto">
        {props.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune validation en attente.</p>
        ) : (
          props.items.map((item) => {
            const meta = actionKindBadge(item.actionKindUi);
            const Icon = meta.icon;
            return (
              <div key={item.id} className="rounded-2xl border border-black/[0.06] p-3 dark:border-border">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold ring-1", meta.className)}>
                      <Icon className="size-3.5" aria-hidden />
                      {meta.label}
                    </span>
                    <span className="text-sm font-medium">{item.prospect.name ?? "Prospect"}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{formatSupervisionDt(item.createdAt)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.previewMessage}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" disabled={actingId === item.id} onClick={() => void postAction("/api/automation/approve", item.id)}>
                    {actingId === item.id ? <Loader2 className="size-4 animate-spin" /> : "Valider"}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={actingId === item.id} onClick={() => void postAction("/api/automation/modify", item.id)}>
                    Modifier
                  </Button>
                  <Button size="sm" variant="outline" disabled={actingId === item.id} onClick={() => void postAction("/api/automation/reject", item.id)}>
                    Refuser
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
