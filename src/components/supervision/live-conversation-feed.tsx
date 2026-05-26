"use client";

import { MessageCircle, Radio, Sparkles, Workflow } from "lucide-react";

import type { SupervisionFeedItem } from "@/lib/supervision/supervision-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { formatSupervisionDt, temperatureTone } from "./supervision-utils";

const KIND_ICON: Record<string, typeof MessageCircle> = {
  user_message: MessageCircle,
  ai_reply: Sparkles,
  followup: Radio,
  workflow: Workflow,
  approval_requested: Workflow,
  agent_action: Sparkles,
  new_conversation: MessageCircle,
};

export function LiveConversationFeed(props: {
  items: SupervisionFeedItem[];
  selectedId?: string | null;
  onSelect?: (conversationId: string) => void;
}) {
  return (
    <Card className="border-black/[0.06] shadow-[0_18px_50px_rgba(15,23,42,0.05)] dark:shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Fil en direct</CardTitle>
        <CardDescription>Conversations, messages, relances et workflows — actualisation continue.</CardDescription>
      </CardHeader>
      <CardContent>
        {props.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune activité récente.</p>
        ) : (
          <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {props.items.map((item) => {
              const Icon = KIND_ICON[item.kind] ?? MessageCircle;
              const active = item.conversationId && props.selectedId === item.conversationId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={!item.conversationId || !props.onSelect}
                    onClick={() => item.conversationId && props.onSelect?.(item.conversationId)}
                    className={cn(
                      "w-full rounded-2xl border p-3 text-left transition hover:bg-muted/40",
                      active && "border-primary/40 bg-primary/[0.05] ring-1 ring-primary/20",
                      !item.conversationId && "cursor-default opacity-90",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <span className="text-[10px] text-muted-foreground">{formatSupervisionDt(item.at)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.preview}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                          {item.agentName ? (
                            <span className="rounded-md bg-muted px-1.5 py-0.5">{item.agentName}</span>
                          ) : null}
                          {item.temperature ? (
                            <span className={cn("font-medium", temperatureTone(item.temperature))}>
                              {item.temperature}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
