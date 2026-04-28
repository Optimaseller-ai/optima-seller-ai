"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { generateMessages } from "@/app/(app)/app/generator/actions";
import { cn } from "@/lib/utils";

type Tone = "pro" | "friendly" | "direct" | "luxury";

export function GeneratorClient() {
  const search = useSearchParams();
  const initialTab = (search.get("tab") ?? "reply") as
    | "reply"
    | "followup"
    | "closing"
    | "status";

  const [tab, setTab] = React.useState(initialTab);
  const [tone, setTone] = React.useState<Tone>("pro");
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const [clientMessage, setClientMessage] = React.useState("");
  const [prospectContext, setProspectContext] = React.useState("");
  const [objection, setObjection] = React.useState("");
  const [topic, setTopic] = React.useState("");

  const [results, setResults] = React.useState<string[]>([]);

  async function run(mode: "reply" | "followup" | "closing" | "status") {
    const input =
      mode === "reply"
        ? clientMessage
        : mode === "followup"
          ? prospectContext
          : mode === "closing"
            ? objection
            : topic;

    if (!input.trim()) {
      toast({ title: "Ajoutez un texte", description: "Remplissez le champ avant de generer." });
      return;
    }

    startTransition(async () => {
      try {
        const res = await generateMessages({ mode, input, tone });
        setResults(res.items);
      } catch (err: unknown) {
        toast({
          title: "Erreur",
          description: getErrorMessage(err) ?? "Impossible de generer.",
          variant: "destructive",
        });
      }
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copie", description: "Message copie dans le presse-papiers." });
    } catch {
      toast({ title: "Copie impossible", description: "Copiez manuellement.", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Generateur IA</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            1 clic, 3 variantes (ou 5 statuts). Mode demo: reponses mock, pret pour API plus tard.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Outil principal
          </CardTitle>
          <CardDescription>Choisissez le cas, remplissez le contexte, genere, puis copiez.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tonalite</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTone(t.id)}
                  className={cn(
                    "h-11 rounded-[var(--radius)] border bg-background px-3 text-left text-sm font-medium transition",
                    tone === t.id ? "border-primary/40 ring-2 ring-primary/20" : "hover:bg-muted/40",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="reply">Reply</TabsTrigger>
              <TabsTrigger value="followup">Follow Up</TabsTrigger>
              <TabsTrigger value="closing">Closing</TabsTrigger>
              <TabsTrigger value="status">Status</TabsTrigger>
            </TabsList>

            <TabsContent value="reply" className="space-y-3">
              <div className="space-y-2">
                <Label>Message du client</Label>
                <Textarea
                  value={clientMessage}
                  onChange={(e) => setClientMessage(e.target.value)}
                  placeholder="ex: Bonsoir, c'est combien ? Livraison a Yaounde ?"
                />
              </div>
              <Button size="lg" className="w-full" onClick={() => run("reply")} disabled={pending}>
                {pending ? "Generation..." : "Generer 3 reponses"}
              </Button>
            </TabsContent>

            <TabsContent value="followup" className="space-y-3">
              <div className="space-y-2">
                <Label>Contexte du prospect</Label>
                <Textarea
                  value={prospectContext}
                  onChange={(e) => setProspectContext(e.target.value)}
                  placeholder="ex: Prospect a demande le prix hier, pas de reponse depuis 24h."
                />
              </div>
              <Button size="lg" className="w-full" onClick={() => run("followup")} disabled={pending}>
                {pending ? "Generation..." : "Generer 3 relances"}
              </Button>
            </TabsContent>

            <TabsContent value="closing" className="space-y-3">
              <div className="space-y-2">
                <Label>Objection du client</Label>
                <Input
                  value={objection}
                  onChange={(e) => setObjection(e.target.value)}
                  placeholder="ex: C'est cher / je vais reflechir / livraison ?"
                />
              </div>
              <Button size="lg" className="w-full" onClick={() => run("closing")} disabled={pending}>
                {pending ? "Generation..." : "Generer 3 reponses closing"}
              </Button>
            </TabsContent>

            <TabsContent value="status" className="space-y-3">
              <div className="space-y-2">
                <Label>Produit / sujet</Label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="ex: Robes, chaussures, gateaux d&apos;anniversaire..."
                />
              </div>
              <Button size="lg" className="w-full" onClick={() => run("status")} disabled={pending}>
                {pending ? "Generation..." : "Generer 5 statuts"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultats</CardTitle>
          <CardDescription>Copiez une variante et collez dans WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {results.length === 0 ? (
            <div className="rounded-[var(--radius)] border bg-muted/30 p-4 text-sm text-muted-foreground">
              Aucun resultat pour l&apos;instant. Lancez une generation.
            </div>
          ) : (
            results.map((r, idx) => (
              <div key={idx} className="rounded-[var(--radius)] border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm whitespace-pre-wrap">{r}</div>
                  <Button variant="secondary" size="icon" onClick={() => copy(r)} aria-label="Copier">
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const TONES: { id: Tone; label: string }[] = [
  { id: "pro", label: "Pro" },
  { id: "friendly", label: "Chaleureux" },
  { id: "direct", label: "Direct" },
  { id: "luxury", label: "Premium" },
];

function getErrorMessage(err: unknown) {
  if (!err) return undefined;
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return undefined;
}
