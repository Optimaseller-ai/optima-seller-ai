import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { addProduct, deleteProduct } from "./actions";
import { DocumentUpload } from "./document-upload";

export default async function CatalogPage() {
  console.log("Render /app/catalog");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/app/catalog");

  const { data: products } = await supabase
    .from("products")
    .select("id,name,price,category,stock,promo,description,created_at")
    .eq("user_id", data.user.id)
    .order("created_at", { ascending: false });

  const { data: documents } = await supabase
    .from("documents")
    .select("id,file_name,file_type,created_at")
    .eq("user_id", data.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)]">Catalogue</h1>
        <p className="mt-1 text-sm text-[var(--brand-navy)]/65">
          Ajoutez vos produits et uploadez vos documents pour alimenter l’IA commerciale.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-[var(--brand-navy)]">Produits</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addProduct} className="grid gap-3">
              <input
                name="name"
                placeholder="Nom (ex: Chaussures Nike)"
                className="h-11 w-full rounded-2xl border border-[var(--brand-navy)]/15 bg-white px-4 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="price"
                  placeholder="Prix (ex: 25000)"
                  inputMode="numeric"
                  className="h-11 w-full rounded-2xl border border-[var(--brand-navy)]/15 bg-white px-4 text-sm"
                />
                <input
                  name="stock"
                  placeholder="Stock (ex: 10)"
                  inputMode="numeric"
                  className="h-11 w-full rounded-2xl border border-[var(--brand-navy)]/15 bg-white px-4 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="category"
                  placeholder="Catégorie (ex: Chaussures)"
                  className="h-11 w-full rounded-2xl border border-[var(--brand-navy)]/15 bg-white px-4 text-sm"
                />
                <input
                  name="promo"
                  placeholder="Promo (optionnel)"
                  className="h-11 w-full rounded-2xl border border-[var(--brand-navy)]/15 bg-white px-4 text-sm"
                />
              </div>
              <textarea
                name="description"
                placeholder="Description"
                className="min-h-28 w-full rounded-2xl border border-[var(--brand-navy)]/15 bg-white px-4 py-3 text-sm"
              />
              <Button className="h-11">Enregistrer</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-[var(--brand-navy)]">Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DocumentUpload />
            <div className="text-xs text-[var(--brand-navy)]/55">Fichiers récents</div>
            <div className="space-y-2">
              {(documents ?? []).map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-2xl border border-[var(--brand-navy)]/10 bg-[rgba(15,23,42,0.02)] px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[var(--brand-navy)]">{d.file_name}</div>
                    <div className="mt-0.5 text-xs text-[var(--brand-navy)]/55">{d.file_type}</div>
                  </div>
                  <div className="shrink-0 text-xs text-[var(--brand-navy)]/55">
                    {d.created_at ? new Date(d.created_at).toLocaleDateString("fr-FR") : "—"}
                  </div>
                </div>
              ))}
              {(!documents || documents.length === 0) && <div className="text-sm text-[var(--brand-navy)]/60">Aucun document uploadé.</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <CardTitle className="text-[var(--brand-navy)]">Liste produits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(products ?? []).map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-2xl border border-[var(--brand-navy)]/10 bg-white p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-[var(--brand-navy)]">{p.name}</div>
                <div className="mt-1 text-sm text-[var(--brand-navy)]/70">
                  {p.price != null ? <span className="font-medium">{p.price} </span> : null}
                  {p.category ? <span>• {p.category} </span> : null}
                  {p.stock != null ? <span>• Stock: {p.stock}</span> : null}
                </div>
                {p.promo ? <div className="mt-1 text-xs text-[var(--brand-green)]">Promo: {p.promo}</div> : null}
                {p.description ? <div className="mt-2 text-sm text-[var(--brand-navy)]/70">{p.description}</div> : null}
              </div>
              <form
                action={async () => {
                  "use server";
                  await deleteProduct(p.id);
                }}
              >
                <Button variant="outline" className="bg-white" type="submit">
                  Supprimer
                </Button>
              </form>
            </div>
          ))}
          {(!products || products.length === 0) && <div className="text-sm text-[var(--brand-navy)]/60">Aucun produit.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

