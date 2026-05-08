import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ success: false, message: "UNAUTHORIZED" }, { status: 401 });

  const { data: conn, error } = await supabase
    .from("whatsapp_connections")
    .select(
      "status,display_phone_number,verified_name,phone_number_id,last_synced_at,token_expires_at,last_error,auto_reply_enabled,paused,human_needed,updated_at,created_at",
    )
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, connection: conn ?? null });
}

