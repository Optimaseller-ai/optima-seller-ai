import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="mx-auto max-w-md px-4 py-6">
        <Link href="/" className="inline-flex">
          <BrandLogo />
        </Link>
      </header>
      <main className="mx-auto max-w-md px-4 pb-10">{children}</main>
    </div>
  );
}

