export const metadata = {
  title: "Privacy Policy • Optima Seller AI",
  description: "Privacy Policy for Optima Seller AI.",
};

export default function PrivacyPage() {
  return (
    <main className="leading-[1.7]">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Privacy Policy</h1>
        <p className="max-w-[65ch] text-base text-[#666]">Your data stays yours. Always.</p>
        <p className="text-sm text-[#666]">Last updated: May 2026</p>
      </header>

      <div className="mt-10 space-y-10">
        <section className="border-t border-black/[0.06] pt-8">
          <h2 className="text-lg font-semibold">Data we collect</h2>
          <div className="mt-3 max-w-[75ch] space-y-3 text-[15px] text-[#111]/85">
            <p>To provide Optima Seller AI, we may collect and process:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Account name (for example the name provided in your profile).</li>
              <li>Your WhatsApp number and identifiers required to connect WhatsApp Business.</li>
              <li>WhatsApp messages (conversation content) to automate replies when enabled.</li>
            </ul>
          </div>
        </section>

        <section className="border-t border-black/[0.06] pt-8">
          <h2 className="text-lg font-semibold">How we use data</h2>
          <div className="mt-3 max-w-[75ch] space-y-3 text-[15px] text-[#111]/85">
            <p>We use data strictly to operate the service, including automating replies based on incoming messages.</p>
          </div>
        </section>

        <section className="border-t border-black/[0.06] pt-8">
          <h2 className="text-lg font-semibold">Secure storage</h2>
          <div className="mt-3 max-w-[75ch] space-y-3 text-[15px] text-[#111]/85">
            <p>
              Data is stored securely. Sensitive secrets such as access tokens are encrypted, and access is restricted to what is required
              to run the service.
            </p>
          </div>
        </section>

        <section className="border-t border-black/[0.06] pt-8">
          <h2 className="text-lg font-semibold">No third‑party data sharing</h2>
          <div className="mt-3 max-w-[75ch] space-y-3 text-[15px] text-[#111]/85">
            <p>
              We do not sell your data. The WhatsApp integration requires technical exchanges with Meta services only to deliver the
              features you enable.
            </p>
          </div>
        </section>

        <section className="border-t border-black/[0.06] pt-8">
          <h2 className="text-lg font-semibold">Data deletion requests</h2>
          <div className="mt-3 max-w-[75ch] space-y-3 text-[15px] text-[#111]/85">
            <p>
              You can request deletion of your data at any time. See{" "}
              <a className="font-medium text-[#2563eb] transition-colors duration-150 hover:text-[#1d4ed8]" href="/data-deletion">
                Data deletion
              </a>
              .
            </p>
          </div>
        </section>

        <section className="border-t border-black/[0.06] pt-8">
          <h2 className="text-lg font-semibold">Contact</h2>
          <div className="mt-3 max-w-[75ch] space-y-3 text-[15px] text-[#111]/85">
            <p>
              Questions or requests:{" "}
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

