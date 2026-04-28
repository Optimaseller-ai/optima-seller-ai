"use client";

import * as React from "react";
import { Gift, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";

type Lead = { contact: string };

export function LeadCapture() {
  const { toast } = useToast();
  const [contact, setContact] = React.useState("");

  function submit() {
    const value = contact.trim();
    if (value.length < 6) {
      toast({ title: "Contact requis", description: "Entrez un email ou un numero WhatsApp." });
      return;
    }

    const lead: Lead = { contact: value };
    window.localStorage.setItem("optima:lead", JSON.stringify(lead));
    toast({ title: "Merci", description: "Vous etes inscrit. (Demo) On vous envoie les 20 scripts." });
    setContact("");
  }

  return (
    <Card className="border-primary/30 bg-background">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="size-4 text-[var(--brand-gold)]" />
          Recevez 20 scripts WhatsApp gratuits + acces beta
        </CardTitle>
        <CardDescription>
          Laissez votre email ou numero WhatsApp. (Capture demo, stockage local pour l&apos;instant.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="lead-contact">Email ou WhatsApp</Label>
          <Input
            id="lead-contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="ex: nadine@gmail.com ou +237..."
          />
        </div>
        <Button className="w-full" size="lg" variant="gold" onClick={submit}>
          <Send className="size-4" />
          Recevoir les scripts
        </Button>
        <LeadPopup />
      </CardContent>
    </Card>
  );
}

function LeadPopup() {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [contact, setContact] = React.useState("");

  React.useEffect(() => {
    const already = window.localStorage.getItem("optima:lead");
    const shown = window.sessionStorage.getItem("optima:lead-popup-shown");
    if (already || shown) return;

    const t = window.setTimeout(() => {
      window.sessionStorage.setItem("optima:lead-popup-shown", "1");
      setOpen(true);
    }, 8000);

    return () => window.clearTimeout(t);
  }, []);

  function submit() {
    const value = contact.trim();
    if (value.length < 6) {
      toast({ title: "Contact requis", description: "Entrez un email ou un numero WhatsApp." });
      return;
    }
    window.localStorage.setItem("optima:lead", JSON.stringify({ contact: value }));
    toast({ title: "Merci", description: "Inscription prise en compte. (Demo)" });
    setOpen(false);
    setContact("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>20 scripts WhatsApp gratuits</DialogTitle>
          <DialogDescription>
            Recevez aussi un acces beta a Optima Seller AI.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="lead-popup">Email ou WhatsApp</Label>
            <Input
              id="lead-popup"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="ex: +225... ou awa@gmail.com"
            />
          </div>
          <Button className="w-full" size="lg" variant="gold" onClick={submit}>
            <Send className="size-4" />
            Recevoir
          </Button>
          <Button className="w-full" size="lg" variant="secondary" onClick={() => setOpen(false)}>
            Plus tard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

