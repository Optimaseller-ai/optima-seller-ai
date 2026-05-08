"use client";

import { motion } from "framer-motion";
import { Search, Sun } from "lucide-react";

type ChatHeaderProps = {
  businessName: string;
  agentAvatarUrl: string;
  avatarOk: boolean;
  initials: string;
  status: string;
  search: string;
  onSearchChange: (value: string) => void;
};

export function ChatHeader(props: ChatHeaderProps) {
  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#fbfcfd]/90 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <motion.div className="relative h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)]">
            {props.avatarOk ? (
              <img src={props.agentAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-emerald-50 text-xs font-semibold text-emerald-700">{props.initials}</div>
            )}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
          </motion.div>

          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-slate-900 sm:text-base">{props.businessName}</div>
            <div className="text-[11px] font-medium text-slate-500">{props.status}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 shadow-[0_1px_4px_rgba(15,23,42,0.04)] sm:flex">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={props.search}
              onChange={(e) => props.onSearchChange(e.target.value)}
              placeholder="Rechercher"
              className="w-36 bg-transparent text-xs text-slate-600 outline-none placeholder:text-slate-400"
              aria-label="Rechercher dans la conversation"
            />
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-full border border-slate-200/80 bg-white text-slate-500 shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
            <Sun className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.header>
  );
}
