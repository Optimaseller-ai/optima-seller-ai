"use client";

import { motion } from "framer-motion";
import { Mic, Paperclip, Send, Smile } from "lucide-react";
import { useEffect, useRef } from "react";

type ChatComposerProps = {
  input: string;
  sending: boolean;
  canSend: boolean;
  hasAttachment: boolean;
  darkMode?: boolean;
  onAttach: () => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
};

function iconHitClass(darkMode: boolean) {
  return `grid h-7 w-7 shrink-0 place-items-center rounded-md transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
    darkMode ? "text-slate-400 hover:bg-white/[0.07] hover:text-slate-100" : "text-slate-500 hover:bg-slate-900/[0.06] hover:text-slate-800"
  }`;
}

export function ChatComposer({ input, sending, canSend, hasAttachment, darkMode = false, onAttach, onInputChange, onSend }: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "0px";
    ref.current.style.height = `${Math.min(72, ref.current.scrollHeight)}px`;
  }, [input]);

  return (
    <div className="w-full pb-[max(6px,env(safe-area-inset-bottom))] pt-1">
      <motion.div
        layout
        className={`relative overflow-hidden rounded-xl p-px shadow-[0_2px_16px_rgba(15,23,42,0.05)] transition-[box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-within:shadow-[0_4px_22px_rgba(15,23,42,0.07)] ${
          darkMode ? "bg-white/[0.07]" : "bg-white/60"
        }`}
      >
        <div
          className={`rounded-[11px] px-1.5 py-1 backdrop-blur-md transition-[background-color] duration-300 ${
            darkMode ? "bg-[#141a20]/75" : "bg-white/75"
          }`}
        >
          <div className="flex items-end gap-1">
            <button type="button" onClick={onAttach} className={iconHitClass(darkMode)} aria-label="Joindre un fichier">
              <span className="relative">
                <Paperclip className="h-[15px] w-[15px]" strokeWidth={1.75} />
                {hasAttachment ? (
                  <span className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#4a9b86] ring-2 ${darkMode ? "ring-[#121820]" : "ring-white"}`} />
                ) : null}
              </span>
            </button>
            <button type="button" className={iconHitClass(darkMode)} aria-label="Emoji">
              <Smile className="h-[15px] w-[15px]" strokeWidth={1.75} />
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
                  if (!canSend || sending) return;
                  onSend();
                }
              }}
              placeholder="Message…"
              className={`max-h-[72px] min-h-[30px] flex-1 resize-none rounded-md px-2.5 py-1.5 text-[13px] font-normal leading-[1.45] outline-none transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] placeholder:font-normal ${
                darkMode ? "bg-transparent text-slate-100 placeholder:text-slate-500" : "bg-transparent text-slate-900 placeholder:text-slate-400"
              }`}
            />
            <button type="button" className={iconHitClass(darkMode)} aria-label="Dictée">
              <Mic className="h-[15px] w-[15px]" strokeWidth={1.75} />
            </button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -0.5 }}
              disabled={!canSend || sending}
              onClick={onSend}
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white shadow-[0_2px_8px_rgba(15,23,42,0.1)] transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:opacity-40 ${
                darkMode ? "bg-[#3d6b5c] hover:bg-[#467a6a]" : "bg-[#3d6b5c] hover:bg-[#355f52]"
              }`}
              aria-label="Envoyer"
            >
              <Send className="h-3 w-3" strokeWidth={2} />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
