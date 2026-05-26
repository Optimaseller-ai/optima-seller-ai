import { Suspense } from "react";
import { GeneratorClient } from "@/app/(app)/app/generator/generator-client";

export default function GeneratorPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Chargement...</div>}>
      <GeneratorClient />
    </Suspense>
  );
}

