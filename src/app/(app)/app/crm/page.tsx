import { createClient } from "@/lib/supabase/server";
import { CrmBoard, type Prospect } from "@/components/crm/crm-board";

export default async function CrmPage() {
  let initial: Prospect[] = demoProspects();

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    try {
      const supabase = await createClient();
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        const { data } = await supabase
          .from("prospects")
          .select("*")
          .eq("user_id", user.user.id)
          .order("created_at", { ascending: true });
        if (data) initial = data as unknown as Prospect[];
      }
    } catch {
      // fallback to demo data
    }
  }

  return <CrmBoard initial={initial} />;
}

function demoProspects(): Prospect[] {
  return [
    {
      id: "demo-1",
      user_id: "demo",
      name: "Client robe - Nadine",
      phone: "+237 6xx xx xx xx",
      notes: "A demande le prix et la livraison a Douala.",
      status: "new",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "demo-2",
      user_id: "demo",
      name: "Prospect chaussures - Ismael",
      phone: "+225 0x xx xx xx",
      notes: "Interessse mais hesite sur la taille.",
      status: "interested",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "demo-3",
      user_id: "demo",
      name: "Commande gateau - Awa",
      phone: "+221 7x xx xx xx",
      notes: "Valide si livraison samedi.",
      status: "won",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
}
