import { Suspense } from "react";
import { LoginClient } from "@/app/(auth)/login/login-client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Chargement...</div>}>
      <LoginClient />
    </Suspense>
  );
}

