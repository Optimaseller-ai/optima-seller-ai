import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ success: false, message: "UNAUTHORIZED" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("whatsapp_connections")
    .upsert(
      {
        user_id: data.user.id,
        status: "disconnected",
        last_error: null,
        phone_number_id: "",
        business_account_id: null,
        token_enc: "",
        token_iv: "",
        token_tag: "",
        token_expires_at: null,
        waba_id: null,
        business_id: null,
        display_phone_number: null,
        verified_name: null,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "user_id" },
    );

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

