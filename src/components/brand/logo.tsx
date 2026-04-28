import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Sparkles className="size-4" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold">Optima Seller AI</div>
        <div className="text-xs text-muted-foreground">WhatsApp vente</div>
      </div>
    </div>
  );
}

