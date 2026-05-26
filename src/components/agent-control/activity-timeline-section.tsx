"use client";

import { useMemo } from "react";
import { Mail, MessageSquare, RadioTower, Send, Timer } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TimelineEntry, TimelineEntryKind } from "@/lib/agent-control-panel/snapshot-types";

import { formatDateTime } from "./display-utils";

function kindIcon(kind: TimelineEntryKind) {
  switch (kind) {
    case "message":
      return MessageSquare;
    case "intent":
      return RadioTower;
    case "action":
      return Send;
    case "email_sent":
      return Mail;
    case "followup_scheduled":
      return Timer;
    default:
      return MessageSquare;
  }
}

function kindLabel(kind: TimelineEntryKind) {
  switch (kind) {
    case "message":
      return "Message";
    case "intent":
      return "Intention";
    case "action":
      return "Action";
    case "email_sent":
      return "Email";
    case "followup_scheduled":
      return "Relance";
    default:
      return kind;
  }
}

export function ActivityTimelineSection(props: { entries: TimelineEntry[] }) {
  const sorted = useMemo(
    () => [...props.entries].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [props.entries],
  );

  return (
    <Card className="border-black/[0.06] shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:shadow-none">
      <CardHeader>
        <CardTitle className="text-lg">Chronologie d’activité</CardTitle>
        <CardDescription>Événements ordonnés du plus récent au plus ancien.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="relative ms-2 border-s border-dashed border-border/80 ps-6">
          {sorted.map((e, idx) => {
            const Icon = kindIcon(e.kind);
            const isLast = idx === sorted.length - 1;
            return (
              <li key={e.id} className={isLast ? "pb-0" : "pb-8"}>
                <span className="absolute -start-[11px] flex h-[22px] w-[22px] items-center justify-center rounded-full border border-border bg-background shadow-sm">
                  <Icon className="size-3.5 text-primary" aria-hidden />
                </span>
                <div className="rounded-xl border border-black/[0.05] bg-muted/15 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                        {kindLabel(e.kind)}
                      </span>
                      <span className="ms-2">{e.label}</span>
                    </p>
                    <time className="text-[11px] tabular-nums text-muted-foreground" dateTime={e.at}>
                      {formatDateTime(e.at)}
                    </time>
                  </div>
                  {e.detail ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{e.detail}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
        {!sorted.length ? (
          <p className="text-sm text-muted-foreground">Aucun événement à afficher.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
