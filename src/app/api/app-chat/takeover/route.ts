import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  liveMode: z.boolean(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { conversationId, liveMode } = parsed.data;

  const { error } = await supabase
    .from("conversations")
    .update({ live_mode: liveMode, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", data.user.id);

  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, liveMode });
}

