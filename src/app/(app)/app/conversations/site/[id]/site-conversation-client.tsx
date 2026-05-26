"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Sender = "visitor" | "ai" | "user";
type Conv = { id: string; visitor_id: string; live_mode: boolean };
type Msg = { id: string; sender: Sender; content: string; created_at?: string };

export default function SiteConversationClient({
  conversation,
  initialMessages,
}: {
  conversation: Conv;
  initialMessages: Msg[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [liveMode, setLiveMode] = useState(Boolean(conversation.live_mode));
  const [messages, setMessages] = useState<Msg[]>(initialMessages ?? []);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight });
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const channel = supabase
      .channel(`conversation_messages:${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const row = payload.new as any;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, { id: row.id, sender: row.sender, content: row.content, created_at: row.created_at }];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversation.id}` },
        (payload) => {
          const row = payload.new as any;
          if (typeof row?.live_mode === "boolean") setLiveMode(row.live_mode);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, supabase]);

  async function toggleTakeover() {
    const next = !liveMode;
    setLiveMode(next);
    await fetch("/api/app-chat/takeover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: conversation.id, liveMode: next }),
    }).catch(() => null);
  }

  async function send() {
    const content = input.trim();
    if (!content) return;
    setInput("");
    await supabase.from("conversation_messages").insert({ conversation_id: conversation.id, sender: "user", content });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-[var(--brand-navy)]">
            Chat site - {conversation.visitor_id.slice(0, 8)}...
          </h1>
          <p className="mt-1 text-sm text-[var(--brand-navy)]/65">
            {liveMode ? "Mode live active - l'IA est arretee." : "Mode IA - reponses automatiques actives."}
          </p>
        </div>
        <button
          type="button"
          className={[
            "h-10 rounded-xl px-4 text-sm font-semibold",
            liveMode ? "bg-[var(--brand-navy)]/10 text-[var(--brand-navy)]" : "bg-[var(--brand-green)] text-white",
          ].join(" ")}
          onClick={toggleTakeover}
        >
          {liveMode ? "Rendre a l'IA" : "Prendre la main"}
        </button>
      </div>

      <div
        ref={listRef}
        className="h-[65dvh] overflow-y-auto rounded-2xl border border-[var(--brand-navy)]/10 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)]"
      >
        {messages.length === 0 ? (
          <div className="text-sm text-[var(--brand-navy)]/60">Aucun message.</div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={m.sender === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={[
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
                    m.sender === "user"
                      ? "bg-[var(--brand-green)] text-white"
                      : m.sender === "visitor"
                        ? "bg-[var(--brand-navy)]/5 text-[var(--brand-navy)]"
                        : "bg-[var(--brand-navy)] text-white",
                  ].join(" ")}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          className="h-11 flex-1 rounded-xl border border-[var(--brand-navy)]/15 bg-white px-3 text-sm text-[var(--brand-navy)] outline-none focus:border-[var(--brand-green)]"
          placeholder="Repondre au prospect..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button
          type="button"
          className="h-11 rounded-xl bg-[var(--brand-green)] px-4 text-sm font-semibold text-white disabled:opacity-60"
          disabled={!input.trim()}
          onClick={send}
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}
