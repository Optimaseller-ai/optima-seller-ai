"use client";

import { memo, useMemo } from "react";

type MessageLite = {
  role: "user" | "assistant";
  content: string;
  ts: string;
};

type ChatInsightsPanelProps = {
  businessName: string;
  agentName: string;
  agentAvatarUrl: string;
  status: string;
  messages: MessageLite[];
  darkMode?: boolean;
};

function ChatInsightsPanelComponent({ businessName, agentName, agentAvatarUrl, status, messages, darkMode = false }: ChatInsightsPanelProps) {
  const line = useMemo(() => {
    const lastReply = [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";
    if (!lastReply) return "En ligne avec vous.";
    const max = 4000;
    return lastReply.length > max ? `${lastReply.slice(0, max)}…` : lastReply;
  }, [messages]);

  const cardBase = darkMode
    ? "border-white/[0.06] bg-white/[0.03] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] ring-1 ring-white/[0.04]"
    : "border-slate-900/[0.06] bg-white/55 shadow-[0_8px_28px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.03]";
  const hoverLift = "transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.09)]";

  return (
    <aside
      className={`chat-sidebar-panel hidden h-full min-h-0 w-full min-w-0 shrink-0 flex-col gap-3 px-2.5 pb-6 pt-4 min-[1200px]:px-3 min-[1200px]:pt-5 lg:flex lg:flex-col ${
        darkMode ? "text-slate-300" : "text-slate-600"
      }`}
    >
      <div className={`rounded-xl border p-3 ${cardBase} ${hoverLift}`}>
        <div className="flex items-start gap-2">
          <div className={`relative mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full ${darkMode ? "ring-1 ring-white/10" : "ring-1 ring-black/[0.06]"}`}>
            <img src={agentAvatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            <span className={`absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full border border-white bg-[#4a9b86] ${darkMode ? "border-[#0c1018]" : ""}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`break-words text-[13px] font-semibold leading-snug ${darkMode ? "text-slate-100" : "text-slate-900"}`}>{agentName}</p>
            <p className={`mt-1 break-words text-[11px] leading-snug ${darkMode ? "text-slate-400" : "text-slate-600"}`}>{businessName}</p>
          </div>
        </div>
      </div>

      <div className={`rounded-xl border p-3 ${cardBase} ${hoverLift}`}>
        <p className={`break-words text-[11px] leading-snug ${darkMode ? "text-[#9ec4b6]" : "text-[#2f5d4f]"}`}>{status}</p>
      </div>

      <div className={`rounded-xl border p-3 ${cardBase} ${hoverLift}`}>
        <p className={`line-clamp-[12] whitespace-pre-wrap break-words text-[11px] leading-relaxed ${darkMode ? "text-slate-200" : "text-slate-800"}`}>{line}</p>
      </div>

      <div className={`rounded-xl border px-3 py-2 ${cardBase} ${hoverLift}`}>
        <p className={`text-[10px] tabular-nums ${darkMode ? "text-slate-400" : "text-slate-600"}`}>{messages.length} messages</p>
      </div>
    </aside>
  );
}

export const ChatInsightsPanel = memo(ChatInsightsPanelComponent);
