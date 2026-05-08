"use client";

import { motion } from "framer-motion";
import { Mic, Paperclip, Send, Smile } from "lucide-react";
import { useEffect, useRef } from "react";

type ChatComposerProps = {
  input: string;
  sending: boolean;
  canSend: boolean;
  hasAttachment: boolean;
  onAttach: () => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
};

export function ChatComposer({ input, sending, canSend, hasAttachment, onAttach, onInputChange, onSend }: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "0px";
    ref.current.style.height = `${Math.min(140, ref.current.scrollHeight)}px`;
  }, [input]);

  return (
    <div className="sticky bottom-0 z-20 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 sm:px-5">
      <motion.div
        layout
        className="rounded-[30px] border border-white/65 bg-white/78 p-2 shadow-[0_18px_55px_rgba(15,23,42,0.12)] backdrop-blur-2xl transition duration-300 focus-within:border-emerald-200/80 focus-within:shadow-[0_18px_60px_rgba(16,185,129,0.16)]"
      >
        <div className="flex items-end gap-2">
          <button
            onClick={onAttach}
            className="grid h-11 w-11 place-items-center rounded-full border border-slate-200/90 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button className="grid h-11 w-11 place-items-center rounded-full border border-slate-200/90 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700">
            <Smile className="h-4 w-4" />
          </button>
          <textarea
            ref={ref}
            rows={1}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onFocus={() => {
              window.setTimeout(() => {
                window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
              }, 110);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Ecrivez votre message..."
            className="max-h-[140px] min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-[14.5px] font-medium leading-[1.5] text-slate-700 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100/80"
          />
          <button className="grid h-11 w-11 place-items-center rounded-full border border-slate-200/90 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700">
            <Mic className="h-4 w-4" />
          </button>
          <motion.button
            whileTap={{ scale: 0.965 }}
            whileHover={{ y: -1 }}
            disabled={!canSend || sending}
            onClick={onSend}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-emerald-400/35 bg-[linear-gradient(135deg,#22b07a_0%,#169969_100%)] px-4 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(22,163,74,0.28)] transition disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {hasAttachment && !input.trim() ? "Envoyer media" : "Envoyer"}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
