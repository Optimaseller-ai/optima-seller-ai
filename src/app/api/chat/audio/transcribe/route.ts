import { NextResponse } from "next/server";

import { processInboundProspectVoice } from "@/lib/audio/audio-conversation-engine";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "missing_audio" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "file_too_large" }, { status: 413 });
    }

    const mimeType = file.type || "audio/webm";
    const durationMs = Number(form.get("durationMs")) || undefined;
    const hourLocal = Number(form.get("hourLocal"));
    let conversationState: Record<string, unknown> | undefined;
    const stateRaw = form.get("conversation_state");
    if (typeof stateRaw === "string") {
      try {
        conversationState = JSON.parse(stateRaw) as Record<string, unknown>;
      } catch {
        conversationState = undefined;
      }
    }

    const result = await processInboundProspectVoice({
      audioBuffer: buffer,
      mimeType,
      conversationState,
      hourLocal: Number.isFinite(hourLocal) ? hourLocal : new Date().getHours(),
      durationMs,
    });

    return NextResponse.json({
      ok: true,
      text: result.messageForChat,
      transcription: result.transcription,
      conversation_state: result.conversationStatePatch,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "AUDIO_TRANSCRIPTION_UNAVAILABLE") {
      return NextResponse.json(
        {
          error: "transcription_unavailable",
          fallback:
            "La transcription vocale n’est pas configurée. Écrivez votre message ou ajoutez OPENAI_API_KEY.",
        },
        { status: 503 },
      );
    }
    console.error("[AUDIO_TRANSCRIBE]", e);
    return NextResponse.json({ error: "transcription_failed" }, { status: 500 });
  }
}
