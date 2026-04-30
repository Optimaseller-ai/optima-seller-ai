import { NextResponse } from "next/server";
import { runChatCore, chatCoreRequestSchema } from "@/lib/ai/chat-core";

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

  const res = await runChatCore({ ...parsed.data, responseFormat: "single" });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res.data, { status: 200 });
}

