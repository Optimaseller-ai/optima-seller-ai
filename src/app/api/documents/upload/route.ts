import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { openRouterEmbed } from "@/lib/ai/openrouter";
import { chunkText } from "@/lib/ai/chunking";

export const runtime = "nodejs";

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, message }, { status });
}

async function extractTextFromFile(file: File) {
  const buf = Buffer.from(await file.arrayBuffer());
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default as any;
    const out = await pdfParse(buf);
    return String(out?.text ?? "");
  }

  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const res = await mammoth.extractRawText({ buffer: buf });
    return String(res?.value ?? "");
  }

  throw new Error("FORMAT_NOT_SUPPORTED");
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return jsonError(401, "UNAUTHORIZED");

  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", auth.user.id).maybeSingle();
  if ((sub?.plan ?? "free") !== "pro") return jsonError(403, "PRO_REQUIRED");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "INVALID_FORMDATA");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError(400, "FILE_REQUIRED");
  if (file.size > 15 * 1024 * 1024) return jsonError(413, "FILE_TOO_LARGE");

  try {
    const text = (await extractTextFromFile(file)).trim();
    if (!text) return jsonError(400, "EMPTY_DOCUMENT");

    const admin = createAdminClient();

    const { data: doc, error: docErr } = await admin
      .from("documents")
      .insert({
        user_id: auth.user.id,
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
        content: text,
      })
      .select("id")
      .maybeSingle();
    if (docErr || !doc?.id) {
      console.error("documents insert error:", docErr);
      return jsonError(500, "DOCUMENT_SAVE_FAILED");
    }

    // Chunk + embeddings (top-level ingestion step for retrieval)
    const chunks = chunkText(text, { chunkSize: 1200, overlap: 150 }).slice(0, 120);
    for (const chunk of chunks) {
      const embedding = await openRouterEmbed({ input: chunk });
      const { error: chunkErr } = await admin.from("document_chunks").insert({
        document_id: doc.id,
        user_id: auth.user.id,
        content: chunk,
        embedding: embedding as any,
      } as any);
      if (chunkErr) {
        console.error("document_chunks insert error:", chunkErr);
        return jsonError(500, "CHUNK_SAVE_FAILED");
      }
    }

    return NextResponse.json({ ok: true, document_id: doc.id });
  } catch (e: any) {
    console.error("documents upload error:", e);
    if (e?.message === "FORMAT_NOT_SUPPORTED") return jsonError(415, "FORMAT_NOT_SUPPORTED");
    return jsonError(500, "UPLOAD_FAILED");
  }
}
