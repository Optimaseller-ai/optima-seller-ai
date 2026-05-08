"use client";

import { motion } from "framer-motion";
import { ChevronLeft, Search, Volume2, VolumeX } from "lucide-react";

type ConversationItem = {
  slug: string;
  businessName: string;
  preview: string;
  unread: number;
  avatarUrl?: string;
};

type ChatSidebarProps = {
  businessName: string;
  preview: string;
  unread: number;
  avatarUrl: string;
  avatarOk: boolean;
  soundsOn: boolean;
  currentSlug: string;
  conversations: ConversationItem[];
  onOpenConversation: (slug: string) => void;
  onToggleSounds: () => void;
};

export function ChatSidebar({
  businessName,
  preview,
  unread,
  avatarUrl,
  avatarOk,
  soundsOn,
  currentSlug,
  conversations,
  onOpenConversation,
  onToggleSounds,
}: ChatSidebarProps) {
  const list = conversations.length
    ? conversations
    : [{ slug: currentSlug, businessName, preview: preview || "Conversation prete", unread, avatarUrl }];

  return (
    <aside className="hidden w-[320px] shrink-0 border-r border-white/50 bg-white/60 p-4 backdrop-blur-2xl lg:block">
      <div className="mb-5 flex items-center justify-between">
        <button className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs text-slate-600">
          <ChevronLeft className="h-3.5 w-3.5" />
          Dashboard
        </button>
        <button onClick={onToggleSounds} className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white/80 text-slate-500">
          {soundsOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-2xl border border-slate-100 bg-white/85 px-3 py-2">
        <Search className="h-4 w-4 text-slate-400" />
        <input placeholder="Rechercher une conversation" className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400" />
      </div>

      <div className="space-y-2">
        {list.map((c) => {
          const active = c.slug === currentSlug;
          return (
            <motion.button
              key={c.slug}
              whileHover={{ y: -2 }}
              onClick={() => onOpenConversation(c.slug)}
              className={[
                "w-full rounded-2xl p-3 text-left shadow-sm transition",
                active ? "border border-emerald-100 bg-white/92" : "border border-slate-200/70 bg-white/80 hover:border-emerald-100",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 overflow-hidden rounded-full border border-slate-200 bg-white">
                    {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" /> : avatarOk ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{c.businessName}</p>
                    <p className="text-[11px] text-slate-400">Service client</p>
                  </div>
                </div>
                {c.unread > 0 ? <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">{c.unread}</span> : null}
              </div>
              <p className="mt-2 truncate text-xs text-slate-500">{c.preview || "Conversation prete"}</p>
            </motion.button>
          );
        })}
      </div>
    </aside>
  );
}
