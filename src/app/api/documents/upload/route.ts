import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    return NextResponse.json({ ok: true, document_id: doc.id });
  } catch (e: any) {
    console.error("documents upload error:", e);
    if (e?.message === "FORMAT_NOT_SUPPORTED") return jsonError(415, "FORMAT_NOT_SUPPORTED");
    return jsonError(500, "UPLOAD_FAILED");
  }
}
