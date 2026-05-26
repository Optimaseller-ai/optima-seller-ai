"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type VoiceNotePlayerProps = {
  src: string;
  durationMs?: number;
  darkMode?: boolean;
  isUser?: boolean;
  transcript?: string;
};

export function VoiceNotePlayer({ src, durationMs = 0, darkMode = false, isUser = false, transcript }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentMs, setCurrentMs] = useState(0);
  const [loadedDurationMs, setLoadedDurationMs] = useState(durationMs);

  const bars = useMemo(() => {
    const seed = src.length;
    return Array.from({ length: 28 }, (_, i) => 28 + ((seed * (i + 3) * 17) % 52));
  }, [src]);

  const displayDurationMs = loadedDurationMs || durationMs;

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  }, [playing]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => {
      const d = el.duration && Number.isFinite(el.duration) ? el.duration * 1000 : displayDurationMs;
      setCurrentMs(el.currentTime * 1000);
      setProgress(d > 0 ? (el.currentTime * 1000) / d : 0);
    };
    const onMeta = () => {
      if (el.duration && Number.isFinite(el.duration)) setLoadedDurationMs(el.duration * 1000);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentMs(0);
    };

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnd);
    };
  }, [displayDurationMs]);

  const playBtnClass = isUser
    ? darkMode
      ? "bg-white/15 text-slate-100"
      : "bg-[#3d6b5c]/12 text-[#2d5246]"
    : darkMode
      ? "bg-[#3d6b5c]/30 text-slate-100"
      : "bg-[#3d6b5c]/10 text-[#355f52]";

  const barActive = isUser
    ? darkMode
      ? "bg-emerald-300/85"
      : "bg-[#3d6b5c]"
    : darkMode
      ? "bg-emerald-400/80"
      : "bg-[#4a8f7a]";

  const barIdle = isUser
    ? darkMode
      ? "bg-white/25"
      : "bg-[#3d6b5c]/25"
    : darkMode
      ? "bg-white/20"
      : "bg-slate-400/35";

  return (
    <div className="flex min-w-[200px] max-w-[min(280px,100%)] flex-col gap-1">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Lire"}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${playBtnClass}`}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <div className="flex flex-1 items-end gap-[2px] py-1" aria-hidden>
          {bars.map((h, i) => {
            const filled = i / bars.length <= progress;
            return (
              <span
                key={i}
                className={`w-[3px] rounded-full transition-colors duration-150 ${filled ? barActive : barIdle}`}
                style={{ height: `${h}%`, minHeight: 4, maxHeight: 22 }}
              />
            );
          })}
        </div>
        <span className={`shrink-0 text-[11px] font-medium tabular-nums ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
          {playing || currentMs > 0 ? formatDuration(currentMs) : formatDuration(displayDurationMs)}
        </span>
      </div>
      {transcript ? (
        <p className={`text-[11px] leading-snug ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{transcript}</p>
      ) : null}
    </div>
  );
}
