"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";

export function WhatsAppConnectClient({ connected }: { connected: boolean }) {
  const { toast } = useToast();
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);

  async function connect() {
    setConnecting(true);
    try {
      const w = window.open("/api/integrations/whatsapp/meta/start", "wa_connect", "popup,width=520,height=720");
      if (!w) throw new Error("Popup bloquée. Autorisez les popups puis réessayez.");

      const onMessage = (ev: MessageEvent) => {
        if (!ev?.data || typeof ev.data !== "object") return;
        const data = ev.data as any;
        if (typeof data.ok !== "boolean") return;
        window.removeEventListener("message", onMessage);
        if (data.ok) {
          toast({ title: "WhatsApp", description: data.message ?? "WhatsApp connecté." });
          window.location.reload();
        } else {
          toast({ title: "WhatsApp", description: data.message ?? "Connexion échouée.", variant: "destructive" });
        }
      };
      window.addEventListener("message", onMessage);
    } catch (e: any) {
      toast({ title: "WhatsApp", description: e?.message ?? "Erreur.", variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      const resp = await fetch("/api/integrations/whatsapp/disconnect", { method: "POST" });
      const json = (await resp.json().catch(() => ({}))) as any;
      if (!resp.ok || !json?.success) throw new Error(json?.message ?? "Erreur.");
      toast({ title: "WhatsApp", description: "Déconnecté." });
      window.location.reload();
    } catch (e: any) {
      toast({ title: "WhatsApp", description: e?.message ?? "Erreur.", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={connect} disabled={connecting} className="shadow-sm">
        {connecting ? "Connexion…" : "Connecter mon WhatsApp"}
      </Button>
      {connected ? (
        <Button onClick={disconnect} disabled={disconnecting} variant="outline" className="bg-white">
          {disconnecting ? "Déconnexion…" : "Déconnecter"}
        </Button>
      ) : null}
    </div>
  );
}

