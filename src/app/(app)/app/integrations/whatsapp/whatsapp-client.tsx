"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";

export function WhatsAppIntegrationClient({
  initial,
}: {
  initial: {
    phone_number_id?: string | null;
    business_account_id?: string | null;
    auto_reply_enabled?: boolean | null;
    paused?: boolean | null;
    human_needed?: boolean | null;
    updated_at?: string | null;
  } | null;
}) {
  const { toast } = useToast();
  const [phoneNumberId, setPhoneNumberId] = React.useState(initial?.phone_number_id ?? "");
  const [businessAccountId, setBusinessAccountId] = React.useState(initial?.business_account_id ?? "");
  const [token, setToken] = React.useState("");
  const [enabled, setEnabled] = React.useState(Boolean(initial?.auto_reply_enabled));
  const [paused, setPaused] = React.useState(Boolean(initial?.paused));
  const [saving, setSaving] = React.useState(false);

  async function onSave() {
    setSaving(true);
    try {
      const resp = await fetch("/api/integrations/whatsapp/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number_id: phoneNumberId.trim(),
          business_account_id: businessAccountId.trim() || null,
          token: token.trim() || null,
          auto_reply_enabled: enabled,
          paused,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as any;
      if (!resp.ok || !data?.ok) throw new Error(typeof data?.error === "string" ? data.error : "Erreur.");
      setToken("");
      toast({ title: "WhatsApp", description: "Connexion enregistrée." });
    } catch (e: any) {
      toast({ title: "WhatsApp", description: e?.message ?? "Erreur.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)]">Intégration WhatsApp</h1>
        <p className="mt-1 text-sm text-[var(--brand-navy)]/65">
          Connectez votre WhatsApp Business (Cloud API) pour activer l’auto-reply Pro.
        </p>
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
        <div className="grid gap-3">
          <label className="text-sm font-medium text-[var(--brand-navy)]">
            Phone Number ID
            <input
              className="mt-1 h-11 w-full rounded-2xl border border-[var(--brand-navy)]/15 bg-white px-4 text-sm"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="ex: 1234567890"
            />
          </label>

          <label className="text-sm font-medium text-[var(--brand-navy)]">
            Business Account ID (optionnel)
            <input
              className="mt-1 h-11 w-full rounded-2xl border border-[var(--brand-navy)]/15 bg-white px-4 text-sm"
              value={businessAccountId}
              onChange={(e) => setBusinessAccountId(e.target.value)}
              placeholder="ex: 1122334455"
            />
          </label>

          <label className="text-sm font-medium text-[var(--brand-navy)]">
            Token permanent (uniquement si vous voulez le modifier)
            <input
              className="mt-1 h-11 w-full rounded-2xl border border-[var(--brand-navy)]/15 bg-white px-4 text-sm"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="EAAG..."
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-[var(--brand-navy)]/80">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Auto reply activé
          </label>

          <label className="flex items-center gap-2 text-sm text-[var(--brand-navy)]/80">
            <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
            Pause (désactive temporairement l’auto-reply)
          </label>

          <Button className="h-11" onClick={onSave} disabled={saving || !phoneNumberId.trim()}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-[rgba(15,23,42,0.02)] p-4 text-sm text-[var(--brand-navy)]/70">
        Webhook à configurer dans Meta: <span className="font-mono">/api/webhooks/whatsapp</span>
      </div>
    </div>
  );
}

