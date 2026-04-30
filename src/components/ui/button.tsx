"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow",
        secondary:
          "bg-muted text-foreground hover:bg-muted/80 border border-border shadow-sm hover:shadow",
        outline: "border border-input bg-transparent hover:bg-muted/60 shadow-sm hover:shadow",
        ghost: "hover:bg-muted/60",
        gold:
          "bg-[var(--brand-gold)] text-black hover:opacity-90 shadow-sm hover:shadow focus-visible:ring-[var(--brand-gold)]",
        destructive:
          "bg-red-600 text-white hover:bg-red-600/90 shadow-sm hover:shadow focus-visible:ring-red-600",
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
