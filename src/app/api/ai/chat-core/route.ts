import { NextResponse } from "next/server";
import { chatCoreRequestSchema, extractItems3FromCoreMessage, runChatCore } from "@/lib/ai/chat-core";
import { createClient } from "@/lib/supabase/server";
import { consumeOneGenerationOrThrow } from "@/lib/quota/consume";
import { isModeAllowed, isResponseFormatAllowed, type PlanId } from "@/lib/plans/gates";

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = chatCoreRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let plan: PlanId = "free";
  let userId: string | null = null;
  let businessProfile: any = null;
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
    userId = auth.user.id;
    const usage = await consumeOneGenerationOrThrow(auth.user.id);
    plan = usage.plan;

    // Fetch profile here using the same authenticated supabase client (avoids auth/session issues in downstream layers)
    const { data: profileRow, error: profileErr } = await supabase
      .from("profiles")
      .select(
        "full_name,business_name,business_type,goal,country,city,whatsapp,offer,first_name,shop_name,main_goal,whatsapp_number,offer_description",
      )
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profileErr) {
      console.log("[AI][MEMORY] PROFILE_FETCH_EMPTY db_error", { message: profileErr.message, code: (profileErr as any)?.code ?? null });
    } else if (!profileRow) {
      console.log("[AI][MEMORY] PROFILE_FETCH_EMPTY row_missing", { userId: auth.user.id });
    } else {
      // normalize similarly to chat-core.ts
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

  const requestedMode = parsed.data.mode ?? "reply";
  const requestedFormat = parsed.data.responseFormat ?? "single";
  const requestedModel = parsed.data.model ?? "openai/gpt-4o-mini";

  if (!isModeAllowed(plan, requestedMode)) {
    return NextResponse.json({ error: "Fonction Pro: mode non disponible sur votre plan." }, { status: 403 });
  }
  if (!isResponseFormatAllowed(plan, requestedFormat)) {
    return NextResponse.json({ error: "Fonction Pro: format de réponse non disponible sur votre plan." }, { status: 403 });
  }
  if (plan !== "pro" && requestedModel !== "openai/gpt-4o-mini") {
    return NextResponse.json({ error: "Fonction Pro: modèles multiples non disponibles sur votre plan." }, { status: 403 });
  }

  const res = await runChatCore({ ...parsed.data, plan, businessProfile });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  if (parsed.data.responseFormat === "items_3") {
    const items = extractItems3FromCoreMessage(res.data.message);
    return NextResponse.json(
      { id: res.data.id, model: res.data.model, items, capabilities: res.data.capabilities },
      { status: 200 },
    );
  }

  return NextResponse.json(res.data, { status: 200 });
}
