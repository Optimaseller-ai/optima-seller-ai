import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  size = "desktop",
}: {
  className?: string;
  size?: "mobile" | "desktop";
}) {
  const px = size === "mobile" ? 36 : 42;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/branding/optima-logo.png"
        alt="Optima Seller AI"
        width={px}
        height={px}
        priority
        className="shrink-0 rounded-xl"
      />
      <div className="leading-tight">
        <div className="text-sm font-semibold">Optima Seller AI</div>
        <div className="text-xs text-muted-foreground">WhatsApp vente</div>
      </div>
    </div>
  );
}
