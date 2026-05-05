import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ success: false, message: "UNAUTHORIZED" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("whatsapp_integrations")
    .upsert(
      {
        user_id: data.user.id,
        status: "disconnected",
        phone_number_id: null,
        meta_business_id: null,
        waba_id: null,
        phone_number: null,
        access_token_enc: "",
        access_token_iv: "",
        access_token_tag: "",
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "user_id" },
    );

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
