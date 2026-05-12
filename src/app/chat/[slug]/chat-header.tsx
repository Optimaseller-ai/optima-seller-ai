"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Layers3, Moon, MoreHorizontal, Search, Sun, X } from "lucide-react";

type ChatHeaderProps = {
  agentName: string;
  /** Métier affiché (ex. Service client, Conseiller WhatsApp) */
  agentRole: string;
  businessName: string;
  agentAvatarUrl: string;
  avatarOk: boolean;
  initials: string;
  status: string;
  search: string;
  onSearchChange: (value: string) => void;
  darkMode: boolean;
  typingActive?: boolean;
  onToggleDarkMode: () => void;
  onCycleBackground: () => void;
  onBack?: () => void;
};

function headerIconBtn(darkMode: boolean) {
  return `grid h-8 w-8 shrink-0 place-items-center rounded-lg transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
    darkMode ? "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100" : "text-slate-500 hover:bg-slate-900/[0.05] hover:text-slate-800"
  }`;
}

export function ChatHeader(props: ChatHeaderProps) {
  return (
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`relative z-30 shrink-0 border-b backdrop-blur-md transition-colors duration-300 ${
        props.darkMode
          ? "border-white/[0.06] bg-[#0f141c]/48 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_10px_36px_rgba(0,0,0,0.18)]"
          : "border-slate-900/[0.06] bg-white/48 shadow-[0_1px_0_rgba(255,255,255,0.75)_inset,0_8px_28px_rgba(15,23,42,0.035)]"
      }`}
    >
      <div className="mx-auto grid w-full max-w-[920px] grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 min-[1200px]:max-w-none min-[1200px]:grid-cols-[1fr_auto_1fr] min-[1200px]:gap-3 min-[1200px]:px-6 min-[1400px]:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            onClick={props.onBack}
            className={`${headerIconBtn(props.darkMode)} lg:hidden`}
            aria-label="Retour"
            type="button"
          >
            <ArrowLeft className="h-[15px] w-[15px]" strokeWidth={1.75} />
          </button>

          <motion.div
            className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-full shadow-[0_2px_8px_rgba(15,23,42,0.08)] ring-1 min-[1200px]:h-9 min-[1200px]:w-9 ${
              props.darkMode ? "ring-white/10" : "ring-black/[0.06]"
            }`}
          >
            {props.avatarOk ? (
              <img src={props.agentAvatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div
                className={`grid h-full w-full place-items-center text-[10px] font-semibold ${
                  props.darkMode ? "bg-white/[0.08] text-slate-200" : "bg-slate-900/[0.06] text-slate-600"
                }`}
              >
                {props.initials}
              </div>
            )}
            <span
              className={`absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full border-2 bg-[#4a9b86] ${
                props.darkMode ? "border-[#0f141c]" : "border-white"
              } ${props.typingActive ? "animate-pulse" : ""}`}
            />
          </motion.div>

          <div className="min-w-0">
            <div className={`truncate text-[14px] font-semibold leading-tight tracking-tight ${props.darkMode ? "text-slate-100" : "text-slate-900"}`}>
              {props.agentName}
            </div>
            <div className={`truncate text-[12px] leading-tight ${props.darkMode ? "text-slate-500" : "text-slate-500"}`}>
              {props.agentRole} · {props.status}
            </div>
          </div>
        </div>

        <div
          className={`hidden min-w-0 items-center justify-center truncate px-2 text-center text-[13px] font-medium leading-tight tracking-tight min-[1200px]:flex ${
            props.darkMode ? "text-slate-300" : "text-slate-700"
          }`}
        >
          {props.businessName}
        </div>

        <div className="ml-auto flex items-center justify-end gap-0.5 min-[1200px]:gap-1">
          <div
            className={`hidden items-center gap-2 rounded-lg px-2.5 py-1 min-[1400px]:flex ${
              props.darkMode ? "bg-white/[0.05]" : "bg-slate-900/[0.035]"
            }`}
          >
            <Search className="h-[14px] w-[14px] shrink-0 opacity-[0.42]" strokeWidth={1.75} />
            <input
              value={props.search}
              onChange={(e) => props.onSearchChange(e.target.value)}
              placeholder="Rechercher…"
              className={`w-40 bg-transparent text-[13px] leading-tight outline-none placeholder:opacity-55 min-[1600px]:w-48 ${
                props.darkMode ? "text-slate-100 placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400"
              }`}
            />
          </div>
          <button className={headerIconBtn(props.darkMode)} aria-label="Basculer le thème" type="button" onClick={props.onToggleDarkMode}>
            {props.darkMode ? <Sun className="h-[15px] w-[15px]" strokeWidth={1.75} /> : <Moon className="h-[15px] w-[15px]" strokeWidth={1.75} />}
          </button>
          <button className={headerIconBtn(props.darkMode)} aria-label="Changer le fond" type="button" onClick={props.onCycleBackground}>
            <Layers3 className="h-[15px] w-[15px]" strokeWidth={1.75} />
          </button>
          <button className={headerIconBtn(props.darkMode)} aria-label="Options" type="button">
            <MoreHorizontal className="h-[15px] w-[15px]" strokeWidth={1.75} />
          </button>
          <button onClick={props.onBack} className={`${headerIconBtn(props.darkMode)} lg:hidden`} aria-label="Fermer" type="button">
            <X className="h-[15px] w-[15px]" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </motion.header>
  );
}
