import { NextResponse } from "next/server";
import { runChatCore, chatCoreRequestSchema } from "@/lib/ai/chat-core";
import { createClient } from "@/lib/supabase/server";
import { consumeOneGenerationOrThrow } from "@/lib/quota/consume";

// Backward-compatible route used by existing clients.
// All logic is delegated to the unified core engine.
export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = chatCoreRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Always fetch latest profile before generation (no cache, no localStorage).
  let businessProfile: any = null;
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
    await consumeOneGenerationOrThrow(auth.user.id);

    const { data: profileRow, error: profileErr } = await supabase
      .from("profiles")
      .select(
        "full_name,business_name,business_type,goal,country,city,whatsapp,offer,first_name,shop_name,main_goal,whatsapp_number,offer_description",
      )
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profileErr) {
      console.log("[AI][MEMORY] PROFILE_FETCH_EMPTY db_error", {
        message: profileErr.message,
        code: (profileErr as any)?.code ?? null,
      });
    } else if (!profileRow) {
      console.log("[AI][MEMORY] PROFILE_FETCH_EMPTY row_missing", { userId: auth.user.id });
    } else {
      const r = profileRow as Record<string, any>;
      businessProfile = {
        ownerName: typeof r.full_name === "string" ? r.full_name : typeof r.first_name === "string" ? r.first_name : null,
        businessName: typeof r.business_name === "string" ? r.business_name : typeof r.shop_name === "string" ? r.shop_name : null,
        businessType: typeof r.business_type === "string" ? r.business_type : null,
        country: typeof r.country === "string" ? r.country : null,
        city: typeof r.city === "string" ? r.city : null,
        whatsapp: typeof r.whatsapp === "string" ? r.whatsapp : typeof r.whatsapp_number === "string" ? r.whatsapp_number : null,
        mainGoal: typeof r.goal === "string" ? r.goal : typeof r.main_goal === "string" ? r.main_goal : null,
        brandTone: null,
        responseStyle: null,
        primaryLanguage: null,
        offer: typeof r.offer === "string" ? r.offer : typeof r.offer_description === "string" ? r.offer_description : null,
      };

      const hasAny = Object.values(businessProfile).some((v) => typeof v === "string" && v.trim().length > 0);
      console.log(hasAny ? "[AI][MEMORY] PROFILE_FETCH_OK" : "[AI][MEMORY] PROFILE_FETCH_EMPTY fields_empty", {
        userId: auth.user.id,
        fields: {
          businessName: Boolean(businessProfile.businessName),
          businessType: Boolean(businessProfile.businessType),
          city: Boolean(businessProfile.city),
          country: Boolean(businessProfile.country),
          offer: Boolean(businessProfile.offer),
          goal: Boolean(businessProfile.mainGoal),
        },
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: typeof err?.message === "string" ? err.message : "Quota atteint." },
      { status: 429 },
    );
  }

  const res = await runChatCore({ ...parsed.data, responseFormat: "single", businessProfile });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res.data, { status: 200 });
}
