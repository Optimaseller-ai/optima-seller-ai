"use client";

import * as React from "react";
import { ArrowUpRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";

export function StartLeekPayCheckoutButton({
  className,
  label = "Continuer vers le paiement",
}: {
  className?: string;
  label?: string;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  async function onStart() {
    if (loading) return;
    setLoading(true);
    try {
      const resp = await fetch("/api/payments/leekpay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      });
      const data = (await resp.json().catch(() => ({}))) as any;
      if (!resp.ok || !data?.success || typeof data?.paymentUrl !== "string") {
        throw new Error(typeof data?.error === "string" ? data.error : "Impossible de lancer le paiement.");
      }
      window.location.href = data.paymentUrl;
    } catch (err: any) {
      toast({
        title: "Paiement indisponible",
        description: typeof err?.message === "string" ? err.message : "Réessayez dans un instant.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="lg"
      variant="gold"
      className={cn(
        "h-11 w-full justify-center shadow-[0_14px_40px_rgba(245,158,11,0.20)] hover:shadow-[0_18px_55px_rgba(245,158,11,0.26)]",
        className,
      )}
      onClick={onStart}
      disabled={loading}
    >
      <Lock className="size-4" />
      {loading ? "Redirection…" : label} <ArrowUpRight className="ml-1 size-4" />
    </Button>
  );
}

