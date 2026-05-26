import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-[var(--brand-navy)]/5",
        "before:absolute before:inset-0 before:-translate-x-full before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.65),transparent)]",
        "motion-safe:before:animate-[shimmer_1.2s_infinite]",
        className,
      )}
    />
  );
}

