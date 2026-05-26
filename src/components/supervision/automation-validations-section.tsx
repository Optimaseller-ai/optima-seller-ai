"use client";

import * as React from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";

import type { AutomationPendingItemDTO } from "@/lib/automation/supervision-dto-types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { formatSupervisionDt } from "./supervision-utils";

export function AutomationValidationsSection(props: {
  items: AutomationPendingItemDTO[];
  onRefresh?: () => void;
  onSelectConversation?: (id: string) => void;
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
        toast({ variant: "destructive", title: "Impossible", description: String(js?.error ?? res.statusText) });
        return;
      }
      toast({
        title: path.endsWith("/approve") ? "C’est validé" : path.endsWith("/reject") ? "Refusé" : "Remis en attente",
      });
      props.onRefresh?.();
    } finally {
      setActingId(null);
    }
  }

  if (!props.items.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Rien à valider — l’équipe gère les conversations en autonomie.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {props.items.map((item) => (
        <li
          key={item.id}
          className="rounded-2xl border border-amber-200/60 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-950/20"
        >
          <button
            type="button"
            className="w-full text-left"
            onClick={() => {
              /* conversation id not always on pending DTO — session only */
            }}
          >
            <p className="text-sm font-medium text-foreground">
              {item.prospect.name ?? "Prospect"} souhaite une action sensible
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {item.intentRationale ?? item.previewMessage}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{formatSupervisionDt(item.createdAt)}</p>
          </button>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="flex-1 gap-1"
              disabled={actingId === item.id}
              onClick={() => void postAction("/api/automation/approve", item.id)}
            >
              {actingId === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Valider
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={actingId === item.id}
              onClick={() => void postAction("/api/automation/modify", item.id)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={actingId === item.id}
              onClick={() => void postAction("/api/automation/reject", item.id)}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
