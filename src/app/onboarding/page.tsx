"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin, Store, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const BUSINESS_TYPES = [
  { id: "fashion", label: "Fashion" },
  { id: "beauty", label: "Beauty" },
  { id: "food", label: "Food" },
  { id: "electronics", label: "Electronics" },
  { id: "services", label: "Services" },
] as const;

const COUNTRIES = [
  "Cameroun",
  "Cote d'Ivoire",
  "Senegal",
  "Benin",
  "Togo",
  "Congo",
] as const;

type OnboardingData = {
  businessType: (typeof BUSINESS_TYPES)[number]["id"] | "";
  country: (typeof COUNTRIES)[number] | "";
  city: string;
  shopName: string;
  firstName: string;
};

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = React.useState(1);
  const [saving, setSaving] = React.useState(false);
  const [data, setData] = React.useState<OnboardingData>(() => {
    if (typeof window === "undefined") {
      return { businessType: "", country: "", city: "", shopName: "", firstName: "" };
    }
    const raw = window.localStorage.getItem("optima:onboarding");
    return raw
      ? (JSON.parse(raw) as OnboardingData)
      : { businessType: "", country: "", city: "", shopName: "", firstName: "" };
  });

  React.useEffect(() => {
    window.localStorage.setItem("optima:onboarding", JSON.stringify(data));
  }, [data]);

  async function finish() {
    setSaving(true);
    try {
      // If Supabase configured and user is logged in, persist profile.
      const supabase = createClient();
      const { data: user } = await supabase.auth.getUser();

      if (!user.user) throw new Error("Connexion requise.");

      const payload = {
        id: user.user.id,
        first_name: data.firstName,
        shop_name: data.shopName,
        business_type: data.businessType,
        country: data.country,
        city: data.city,
        onboarding_completed: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      toast({ title: "Onboarding termine", description: "Bienvenue dans Optima Seller AI." });
      window.localStorage.removeItem("optima:onboarding");
      router.push("/app");
    } catch (err: unknown) {
      toast({
        title: "Sauvegarde impossible",
        description:
          getErrorMessage(err) ??
          "Mode demo: configurez Supabase pour sauvegarder. Vous pouvez quand meme visiter l'app.",
        variant: "destructive",
      });
      router.push("/app");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-lg px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Configuration rapide</CardTitle>
            <CardDescription>3 etapes. Mobile-first, simple et rapide.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Stepper step={step} />

            {step === 1 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="size-4 text-primary" /> Type de business
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {BUSINESS_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setData((d) => ({ ...d, businessType: t.id }))}
                      className={cn(
                        "h-12 rounded-[var(--radius)] border bg-background px-3 text-left text-sm font-medium transition",
                        data.businessType === t.id
                          ? "border-primary/40 ring-2 ring-primary/20"
                          : "hover:bg-muted/40",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1"
                    size="lg"
                    onClick={() => setStep(2)}
                    disabled={!data.businessType}
                  >
                    Continuer
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="size-4 text-primary" /> Pays et ville
                </div>
                <div className="space-y-2">
                  <Label>Pays</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {COUNTRIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setData((d) => ({ ...d, country: c }))}
                        className={cn(
                          "h-12 rounded-[var(--radius)] border bg-background px-3 text-left text-sm font-medium transition",
                          data.country === c
                            ? "border-primary/40 ring-2 ring-primary/20"
                            : "hover:bg-muted/40",
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    value={data.city}
                    onChange={(e) => setData((d) => ({ ...d, city: e.target.value }))}
                    placeholder="ex: Douala, Abidjan, Dakar..."
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" size="lg" className="flex-1" onClick={() => setStep(1)}>
                    Retour
                  </Button>
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={() => setStep(3)}
                    disabled={!data.country || data.city.trim().length < 2}
                  >
                    Continuer
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Store className="size-4 text-primary" /> Boutique
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shop">Nom de la boutique</Label>
                  <Input
                    id="shop"
                    value={data.shopName}
                    onChange={(e) => setData((d) => ({ ...d, shopName: e.target.value }))}
                    placeholder="ex: Boutique Nadine"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prenom</Label>
                  <Input
                    id="firstName"
                    value={data.firstName}
                    onChange={(e) => setData((d) => ({ ...d, firstName: e.target.value }))}
                    placeholder="ex: Nadine"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" size="lg" className="flex-1" onClick={() => setStep(2)}>
                    Retour
                  </Button>
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={finish}
                    disabled={saving || data.shopName.trim().length < 2 || data.firstName.trim().length < 2}
                  >
                    {saving ? "Finalisation..." : "Terminer"}
                  </Button>
                </div>
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Vos infos servent a personnaliser le ton des messages. Vous pourrez les modifier plus tard.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function getErrorMessage(err: unknown) {
  if (!err) return undefined;
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return undefined;
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[1, 2, 3].map((s) => (
        <div key={s} className="space-y-1">
          <div
            className={cn(
              "h-2 rounded-full",
              s <= step ? "bg-primary" : "bg-border",
            )}
          />
          <div className="text-[11px] text-muted-foreground">Etape {s}</div>
        </div>
      ))}
    </div>
  );
}
