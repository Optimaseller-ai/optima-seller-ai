"use client";

import { memo, useMemo } from "react";
import { Volume2, VolumeX } from "lucide-react";

type ChatSidebarProps = {
  businessName: string;
  avatarUrl: string;
  avatarOk: boolean;
  soundsOn: boolean;
  status: string;
  /** Micro-ligne « humaine » (ex. Répond rapidement) */
  agentStatusHint?: string;
  lastActiveLabel: string;
  messages: Array<{ role: "user" | "assistant"; content: string; ts: string }>;
  darkMode?: boolean;
  onToggleSounds: () => void;
};

function ChatSidebarComponent({
  businessName,
  avatarUrl,
  avatarOk,
  soundsOn,
  status,
  agentStatusHint,
  lastActiveLabel,
  messages,
  darkMode = false,
  onToggleSounds,
}: ChatSidebarProps) {
  const tags = useMemo(() => {
    const joined = messages.map((m) => m.content.toLowerCase()).join(" ");
    const out: string[] = [];
    if (/\b(prix|tarif|combien)\b/.test(joined)) out.push("Prix");
    if (/\b(stock|disponible)\b/.test(joined)) out.push("Stock");
    if (/\b(livraison|adresse)\b/.test(joined)) out.push("Livraison");
    if (/\b(payer|paiement|commande)\b/.test(joined)) out.push("Achat");
    return out.slice(0, 4);
  }, [messages]);

  const tagLine = tags.length ? tags.join(" · ") : "—";

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
        <div className="flex items-start justify-between gap-2">
          <p className={`min-w-0 flex-1 break-words text-[13px] font-semibold leading-snug ${darkMode ? "text-slate-100" : "text-slate-900"}`}>
            {businessName || "Prospect"}
          </p>
          <button
            type="button"
            onClick={onToggleSounds}
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition duration-200 ${
              darkMode ? "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200" : "text-slate-500 hover:bg-slate-900/[0.05] hover:text-slate-800"
            }`}
            aria-label={soundsOn ? "Désactiver les sons" : "Activer les sons"}
            suppressHydrationWarning
          >
            {soundsOn ? <Volume2 className="h-[14px] w-[14px]" strokeWidth={1.75} /> : <VolumeX className="h-[14px] w-[14px]" strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      <div className={`rounded-xl border p-3 ${cardBase} ${hoverLift}`}>
        <div className="flex items-start gap-2">
          <div className={`relative mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full ${darkMode ? "ring-1 ring-white/10" : "ring-1 ring-black/[0.06]"}`}>
            {avatarOk ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
            <span className={`absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full border border-white bg-[#4a9b86] ${darkMode ? "border-[#0c1018]" : ""}`} />
          </div>
          <p className="min-w-0 flex-1 break-words text-[11px] leading-snug">{status}</p>
        </div>
        {agentStatusHint ? (
          <p className={`mt-1.5 break-words text-[10px] leading-snug ${darkMode ? "text-slate-500" : "text-slate-500"}`}>{agentStatusHint}</p>
        ) : null}
        <p className={`mt-2.5 break-words text-[11px] leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-600"}`}>{lastActiveLabel}</p>
      </div>

      <div className={`rounded-xl border p-3 ${cardBase} ${hoverLift}`}>
        <p className={`text-[10px] font-medium uppercase tracking-wide ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Signaux</p>
        <p className={`mt-1.5 break-words text-[11px] leading-snug ${darkMode ? "text-slate-200" : "text-slate-800"}`}>{tagLine}</p>
      </div>
    </aside>
  );
}

export const ChatSidebar = memo(ChatSidebarComponent);
