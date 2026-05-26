"use client";

import { CalendarClock, CheckCircle2, Loader2, Mail, MessageCircle, Workflow } from "lucide-react";

import type { SupervisionAutomationStory } from "@/lib/supervision/supervision-types";
import { cn } from "@/lib/utils";

import { formatSupervisionDt } from "./supervision-utils";

const KIND_ICON = {
  email: Mail,
  whatsapp: MessageCircle,
  workflow: Workflow,
  followup: CalendarClock,
} as const;

const STATUS_DOT: Record<SupervisionAutomationStory["status"], string> = {
  needs_you: "bg-amber-500",
  scheduled: "bg-violet-500",
  running: "bg-emerald-500 animate-pulse",
  queued: "bg-muted-foreground/50",
  done: "bg-emerald-600/70",
};

export function AutomationCompactList(props: {
  items: SupervisionAutomationStory[];
  emptyMessage: string;
  onSelectConversation?: (id: string) => void;
}) {
  if (!props.items.length) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{props.emptyMessage}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {props.items.map((item) => {
        const Icon = KIND_ICON[item.kind] ?? Workflow;
        return (
          <li key={item.id}>
            <button
              type="button"
              disabled={!item.conversationId || !props.onSelectConversation}
              onClick={() => item.conversationId && props.onSelectConversation?.(item.conversationId)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-xl px-2 py-2.5 text-left transition hover:bg-muted/50",
                !item.conversationId && "cursor-default",
              )}
            >
              <span className={cn("mt-2 size-2 shrink-0 rounded-full", STATUS_DOT[item.status])} aria-hidden />
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-foreground">{item.label}</p>
                {item.preview ? (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.preview}</p>
                ) : null}
                <p className="mt-1 text-[10px] text-muted-foreground">{formatSupervisionDt(item.at)}</p>
              </div>
              {item.status === "running" ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-emerald-600" aria-hidden />
              ) : item.status === "done" ? (
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600/80" aria-hidden />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
