"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none transition-colors",
  {
    variants: {
      variant: {
        default: "border-[var(--brand-navy)]/10 bg-white text-[var(--brand-navy)]/75",
        muted: "border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] text-[var(--brand-navy)]/70",
        success: "border-[rgba(22,163,74,0.22)] bg-[rgba(22,163,74,0.10)] text-[var(--brand-navy)]",
        gold: "border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.14)] text-[var(--brand-navy)]",
        pro: "border-[rgba(245,158,11,0.35)] bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(22,163,74,0.10))] text-[var(--brand-navy)]",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-1 text-[11px]",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size, className }))} {...props} />;
}

