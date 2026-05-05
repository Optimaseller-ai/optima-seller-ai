"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";

export function DocumentUpload() {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const resp = await fetch("/api/documents/upload", { method: "POST", body: fd });
      const json = (await resp.json().catch(() => ({}))) as any;
      if (!resp.ok || !json?.ok) {
        const msg =
          json?.message === "FORMAT_NOT_SUPPORTED"
            ? "Format non supporté. Utilisez PDF ou DOCX."
            : json?.message === "EMPTY_DOCUMENT"
              ? "Document vide."
              : "Upload échoué.";
        throw new Error(msg);
      }
      toast({ title: "Documents", description: "Upload OK." });
      window.location.reload();
    } catch (e: any) {
      toast({ title: "Documents", description: e?.message ?? "Erreur.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  function onPick() {
    inputRef.current?.click();
  }

  function onDrop(ev: React.DragEvent) {
    ev.preventDefault();
    const f = ev.dataTransfer.files?.[0];
    if (f) void upload(f);
  }

  return (
    <div
      className="rounded-[var(--radius)] border border-dashed border-[var(--brand-navy)]/20 bg-white p-5"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-[var(--brand-navy)]">Upload document</div>
          <div className="mt-1 text-xs text-[var(--brand-navy)]/60">Glissez-déposez un PDF ou DOCX, ou choisissez un fichier.</div>
        </div>
        <Button onClick={onPick} disabled={busy} className="h-10">
          {busy ? "Upload…" : "Choisir"}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
    </div>
  );
}
