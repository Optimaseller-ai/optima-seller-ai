"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UpgradeButton({
  disabled,
  label = "Passer Pro",
  className,
}: {
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  // Route users through our own premium pre-checkout marketing page before LeekPay.
  const [loading, setLoading] = React.useState(false);

  return (
    <Button
      asChild
      size="lg"
      variant="gold"
      className={cn(
        "h-11 shadow-[0_14px_40px_rgba(245,158,11,0.20)] hover:shadow-[0_18px_55px_rgba(245,158,11,0.26)]",
        disabled ? "pointer-events-none opacity-75" : null,
        className,
      )}
      disabled={disabled || loading}
    >
      <Link
        href="/checkout/pro"
        onClick={() => {
          if (disabled) return;
          setLoading(true);
        }}
        className="inline-flex items-center gap-2"
      >
        <Crown className="size-4" />
        {loading ? "Redirection…" : label} <ArrowUpRight className="ml-1 size-4" />
      </Link>
    </Button>
  );
}

