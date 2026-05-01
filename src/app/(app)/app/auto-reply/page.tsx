import { MessageSquareReply } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoReplyClient } from "@/app/(app)/app/auto-reply/ui";

export default function AutoReplyPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[var(--brand-navy)] sm:text-3xl">
          <MessageSquareReply className="size-6 text-[var(--brand-green)]" />
          Auto Reply (semi‑auto)
        </h1>
        <p className="text-sm text-[var(--brand-navy)]/65 sm:text-base">
          Collez le message du client. Optima génère une réponse prête à envoyer sur WhatsApp.
        </p>
      </div>

      <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <CardTitle className="text-[var(--brand-navy)]">Réponse instantanée</CardTitle>
          <CardDescription>
            Mode manuel aujourd’hui. Architecture prête pour WhatsApp API (Twilio / 360dialog / Meta Cloud).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AutoReplyClient />
        </CardContent>
      </Card>
    </div>
  );
}

