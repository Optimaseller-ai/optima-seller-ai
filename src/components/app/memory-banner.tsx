"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/data/use-profile";
import { computeMemoryStatus } from "@/lib/data/business-memory";
import { Button } from "@/components/ui/button";

export function MemoryBanner({ compact }: { compact?: boolean }) {
  const p = useProfile();
  const { status } = computeMemoryStatus(p.profile);

  if (status === "active") {
    if (compact) return null;
    return (
      <div className="rounded-[var(--radius)] border border-[var(--brand-green)]/20 bg-[rgba(22,163,74,0.06)] p-3 text-sm text-[var(--brand-navy)]/80">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <CheckCircle2 className="size-4 text-[var(--brand-green)]" />
            <span className="font-medium text-[var(--brand-navy)]">Mémoire IA active</span>
          </div>
          <Button asChild variant="outline" className="h-9 bg-white">
            <Link href="/app/profile">Voir profil</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === "missing" || status === "incomplete") {
    return (
      <div
        className={cn(
          "rounded-[var(--radius)] border border-[var(--brand-gold)]/30 bg-[rgba(245,158,11,0.10)] p-3 text-sm text-[var(--brand-navy)]/85",
          compact ? "p-2 text-xs" : undefined,
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <AlertTriangle className={cn("text-[var(--brand-gold)]", compact ? "size-4" : "size-5")} />
            <span className="font-medium text-[var(--brand-navy)]">Profil incomplet, IA limitée.</span>
          </div>
          <Button
            asChild
            className={cn(
              "bg-[var(--brand-navy)] text-white hover:bg-[var(--brand-navy)]/90",
              compact ? "h-8" : "h-9",
            )}
          >
            <Link href="/app/profile">Compléter</Link>
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
