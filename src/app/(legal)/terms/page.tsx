export const metadata = {
  title: "Terms of Use • Optima Seller AI",
  description: "Terms of Use for Optima Seller AI.",
};

export default function TermsPage() {
  return (
    <main className="leading-[1.7]">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Terms of Use</h1>
        <p className="max-w-[65ch] text-base text-[#666]">Clear terms. Simple rules. Built for trust.</p>
        <p className="text-sm text-[#666]">Last updated: May 2026</p>
      </header>

      <div className="mt-10 space-y-10">
        <section className="border-t border-black/[0.06] pt-8">
          <h2 className="text-lg font-semibold">1. Service description</h2>
          <div className="mt-3 max-w-[75ch] space-y-3 text-[15px] text-[#111]/85">
            <p>Optima Seller AI helps businesses automate WhatsApp replies.</p>
          </div>
        </section>

        <section className="border-t border-black/[0.06] pt-8">
          <h2 className="text-lg font-semibold">2. Usage</h2>
          <div className="mt-3 max-w-[75ch] space-y-3 text-[15px] text-[#111]/85">
            <p>You are responsible for messages sent through your WhatsApp account.</p>
          </div>
        </section>

        <section className="border-t border-black/[0.06] pt-8">
          <h2 className="text-lg font-semibold">3. Data</h2>
          <div className="mt-3 max-w-[75ch] space-y-3 text-[15px] text-[#111]/85">
            <p>Data is used only to operate the service.</p>
          </div>
        </section>

        <section className="border-t border-black/[0.06] pt-8">
          <h2 className="text-lg font-semibold">4. Liability</h2>
          <div className="mt-3 max-w-[75ch] space-y-3 text-[15px] text-[#111]/85">
            <p>Optima Seller AI is not responsible for losses caused by misuse of the service.</p>
          </div>
        </section>

        <section className="border-t border-black/[0.06] pt-8">
          <h2 className="text-lg font-semibold">5. Suspension</h2>
          <div className="mt-3 max-w-[75ch] space-y-3 text-[15px] text-[#111]/85">
            <p>We may suspend an account in case of abuse.</p>
          </div>
        </section>

        <section className="border-t border-black/[0.06] pt-8">
          <h2 className="text-lg font-semibold">6. Changes</h2>
          <div className="mt-3 max-w-[75ch] space-y-3 text-[15px] text-[#111]/85">
            <p>These terms may be updated at any time.</p>
          </div>
        </section>

        <section className="border-t border-black/[0.06] pt-8">
          <h2 className="text-lg font-semibold">7. Contact</h2>
          <div className="mt-3 max-w-[75ch] space-y-3 text-[15px] text-[#111]/85">
            <p>
              Contact:{" "}
              <a className="font-medium text-[#2563eb] transition-colors duration-150 hover:text-[#1d4ed8]" href="mailto:support@optima.ai">
                support@optima.ai
              </a>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

