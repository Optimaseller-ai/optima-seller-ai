import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ success: false, message: "UNAUTHORIZED" }, { status: 401 });

  const { data: integration, error } = await supabase
    .from("whatsapp_integrations")
    .select("status,phone_number,phone_number_id,meta_business_id,waba_id,created_at")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, integration: integration ?? null });
}
