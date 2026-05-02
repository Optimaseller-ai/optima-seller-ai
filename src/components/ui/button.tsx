"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-px motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-[0_14px_40px_rgba(22,163,74,0.18)] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
        secondary:
          "border border-border bg-muted text-foreground shadow-sm hover:bg-muted/80 hover:shadow hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
        outline:
          "border border-input bg-transparent shadow-sm hover:bg-muted/60 hover:shadow hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
        ghost: "hover:bg-muted/60 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
        gold:
          "bg-[var(--brand-gold)] text-black shadow-sm hover:opacity-95 hover:shadow-[0_14px_40px_rgba(245,158,11,0.18)] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 focus-visible:ring-[var(--brand-gold)]",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-600/90 hover:shadow hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 focus-visible:ring-red-600",
      },
      size: {
        sm: "h-10 px-3 text-sm",
        default: "h-11 px-4 text-sm",
        lg: "h-12 px-5 text-sm",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
