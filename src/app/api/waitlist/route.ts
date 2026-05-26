import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => null)) as { feature?: string } | null;
  const feature = (raw?.feature ?? "").trim();
  if (!feature) return NextResponse.json({ error: "Missing feature" }, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("waitlist_features").upsert(
    {
      user_id: data.user.id,
      feature,
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id,feature" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

