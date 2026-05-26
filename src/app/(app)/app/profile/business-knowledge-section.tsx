"use client";

import { BookOpen, HelpCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { saveProfileBusinessKnowledge, addProfileBusinessFaq, deleteProfileBusinessFaq } from "./business-knowledge-actions";
import type { BusinessFaqEntry } from "@/lib/business-knowledge/types";
import type { BusinessKnowledgeSettingsRow } from "@/lib/business-knowledge/types";
import type { ProfileIdentityForKnowledge } from "@/lib/business-knowledge/types";

const inputClass =
  "h-11 w-full rounded-2xl border border-[var(--brand-navy)]/15 bg-white px-4 text-sm text-[var(--brand-navy)]";
const textareaClass =
  "min-h-[88px] w-full rounded-2xl border border-[var(--brand-navy)]/15 bg-white px-4 py-3 text-sm text-[var(--brand-navy)]";

function IdentitySummary({ identity }: { identity: ProfileIdentityForKnowledge }) {
  const rows = [
    { label: "Entreprise", value: identity.businessName },
    { label: "Secteur", value: identity.sector },
    { label: "Pays", value: identity.country },
    { label: "Ville", value: identity.city },
    { label: "Fuseau", value: identity.timezoneLabel },
    { label: "Contact", value: identity.contactPhone },
    { label: "Offre (profil)", value: identity.offer },
  ].filter((r) => r.value);

  if (!rows.length) return null;

  return (
    <div className="rounded-2xl border border-dashed border-[var(--brand-navy)]/15 bg-[rgba(15,23,42,0.02)] p-4 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-navy)]/55">
        Repris depuis Infos business (non dupliqué)
      </p>
      <ul className="mt-2 space-y-1 text-[var(--brand-navy)]/80">
        {rows.map((r) => (
          <li key={r.label}>
            <span className="font-medium text-[var(--brand-navy)]">{r.label} :</span> {r.value}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BusinessKnowledgeSection({
  identity,
  settings,
  faqEntries,
}: {
  identity: ProfileIdentityForKnowledge;
  settings: BusinessKnowledgeSettingsRow | null;
  faqEntries: BusinessFaqEntry[];
}) {
  const servedExtra = (settings?.served_cities ?? []).filter(
    (c) => c.toLowerCase() !== (identity.city ?? "").toLowerCase(),
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="size-5 text-[var(--brand-green)]" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold text-[var(--brand-navy)]">Base de connaissance</h2>
          <p className="text-sm text-[var(--brand-navy)]/65">
            Mémoire commerciale des agents — livraison, SAV, FAQ. Les produits restent dans le catalogue.
          </p>
        </div>
      </div>

      <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <CardTitle className="text-[var(--brand-navy)]">Politiques & vente</CardTitle>
          <CardDescription>Enrichit la mémoire IA sans remplacer votre profil business.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <IdentitySummary identity={identity} />

          <form action={saveProfileBusinessKnowledge} className="grid gap-3">
            <input
              name="served_cities_extra"
              defaultValue={servedExtra.join(", ")}
              placeholder="Autres villes desservies (en plus de votre ville profil)"
              className={inputClass}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="business_hours_weekday"
                defaultValue={settings?.business_hours_weekday ?? ""}
                placeholder="Horaires semaine"
                className={inputClass}
              />
              <input
                name="business_hours_weekend"
                defaultValue={settings?.business_hours_weekend ?? ""}
                placeholder="Horaires week-end"
                className={inputClass}
              />
            </div>
            <textarea
              name="delivery_zones_notes"
              defaultValue={settings?.delivery_zones_notes ?? ""}
              placeholder="Livraison — zones et conditions"
              className={textareaClass}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="delivery_delay_notes"
                defaultValue={settings?.delivery_delay_notes ?? ""}
                placeholder="Délais (ex. Douala 24h)"
                className={inputClass}
              />
              <input
                name="delivery_cost_notes"
                defaultValue={settings?.delivery_cost_notes ?? ""}
                placeholder="Coûts livraison"
                className={inputClass}
              />
            </div>
            <input
              name="delivery_methods"
              defaultValue={settings?.delivery_methods ?? ""}
              placeholder="Modes de livraison"
              className={inputClass}
            />
            <textarea
              name="payment_notes"
              defaultValue={settings?.payment_notes ?? ""}
              placeholder="Paiement (Mobile Money, acompte…)"
              className={textareaClass}
            />
            <select name="sales_style" className={inputClass} defaultValue={settings?.sales_style ?? "balanced"}>
              <option value="soft">Soft — écoute, sans pression</option>
              <option value="balanced">Balanced — conseil équilibré</option>
              <option value="aggressive">Aggressive — rythme direct</option>
              <option value="premium">Premium — ton haut de gamme</option>
            </select>
            <textarea
              name="sales_style_notes"
              defaultValue={settings?.sales_style_notes ?? ""}
              placeholder="Style de vente (ton, posture, phrases types)"
              className={textareaClass}
            />
            <textarea
              name="commercial_instructions"
              defaultValue={settings?.commercial_instructions ?? ""}
              placeholder="Instructions commerciales pour l'agent"
              className={textareaClass}
            />
            <textarea
              name="company_important_notes"
              defaultValue={settings?.company_important_notes ?? ""}
              placeholder="Informations importantes (qualité, contrôle avant expédition…)"
              className={textareaClass}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <textarea
                name="warranty_notes"
                defaultValue={settings?.warranty_notes ?? ""}
                placeholder="Garantie"
                className={textareaClass}
              />
              <textarea
                name="sav_notes"
                defaultValue={settings?.sav_notes ?? ""}
                placeholder="SAV"
                className={textareaClass}
              />
            </div>
            <textarea
              name="return_policy_summary"
              defaultValue={settings?.return_policy_summary ?? ""}
              placeholder="Retours & remboursements"
              className={textareaClass}
            />
            <Button type="submit" className="h-11 w-full sm:w-auto">
              Enregistrer la base de connaissance
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[var(--brand-navy)]">
            <HelpCircle className="size-5 text-[var(--brand-green)]" aria-hidden />
            FAQ validée
          </CardTitle>
          <CardDescription>Réponses fréquentes que l'agent peut citer naturellement.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={addProfileBusinessFaq} className="grid gap-3">
            <select name="category" className={inputClass} defaultValue="delivery">
              <option value="delivery">Livraison</option>
              <option value="payment">Paiement</option>
              <option value="warranty">Garantie</option>
              <option value="sav">SAV</option>
              <option value="returns">Retour produit</option>
              <option value="hours">Horaires</option>
              <option value="general">Général</option>
            </select>
            <input name="question" placeholder="Question fréquente" className={inputClass} required />
            <textarea name="answer" placeholder="Réponse validée" className={textareaClass} required />
            <Button type="submit" variant="outline" className="h-11 bg-white">
              Ajouter une FAQ
            </Button>
          </form>

          <ul className="space-y-2">
            {faqEntries.map((f) => (
              <li
                key={f.id}
                className="flex flex-col gap-2 rounded-2xl border border-[var(--brand-navy)]/10 p-4 sm:flex-row sm:justify-between"
              >
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase text-[var(--brand-green)]">{f.category}</span>
                  <p className="mt-1 font-medium text-[var(--brand-navy)]">{f.question}</p>
                  <p className="mt-1 text-sm text-[var(--brand-navy)]/70">{f.answer}</p>
                </div>
                <form action={deleteProfileBusinessFaq.bind(null, f.id)}>
                  <Button type="submit" variant="outline" size="sm" className="bg-white">
                    Supprimer
                  </Button>
                </form>
              </li>
            ))}
            {!faqEntries.length ? (
              <p className="text-sm text-[var(--brand-navy)]/60">Aucune FAQ pour le moment.</p>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
