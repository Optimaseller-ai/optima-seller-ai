import { NextResponse } from "next/server";
import { chatCoreRequestSchema, extractItems3FromCoreMessage, runChatCore } from "@/lib/ai/chat-core";
import { createClient } from "@/lib/supabase/server";
import { consumeOneGenerationOrThrow } from "@/lib/quota/consume";

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = chatCoreRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
    await consumeOneGenerationOrThrow(auth.user.id);
  } catch (err: any) {
    return NextResponse.json(
      { error: typeof err?.message === "string" ? err.message : "Quota atteint." },
      { status: 429 },
    );
  }

  const res = await runChatCore(parsed.data);
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
