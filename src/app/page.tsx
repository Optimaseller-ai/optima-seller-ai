import { Inter, Poppins } from "next/font/google";
import { UnifiedNavbarServer } from "@/components/nav/unified-navbar-server";
import { HomeClient } from "@/app/home-client";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-home-inter",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-home-poppins",
});

export default function HomePage() {
  const className = `${inter.variable} ${poppins.variable} min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] [font-family:var(--font-home-inter),var(--font-sans)]`;

  return (
    <div className={className}>
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_20%_10%,rgba(22,163,74,0.12),transparent_60%),radial-gradient(56rem_40rem_at_90%_0%,rgba(245,158,11,0.12),transparent_55%),radial-gradient(48rem_36rem_at_70%_90%,rgba(15,23,42,0.10),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(15,23,42,0.6)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.6)_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>

      <UnifiedNavbarServer />
      <HomeClient className="" />
    </div>
  );
}

