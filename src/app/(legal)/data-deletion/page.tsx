export const metadata = {
  title: "Data Deletion • Optima Seller AI",
  description: "Request deletion of your data from Optima Seller AI.",
};

export default function DataDeletionPage() {
  return (
    <main className="leading-[1.7]">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Data Deletion</h1>
        <p className="max-w-[65ch] text-base text-[#666]">Request removal of your data. Fast, simple, and verified.</p>
        <p className="text-sm text-[#666]">Last updated: May 2026</p>
      </header>

      <section className="mt-12 border border-black/[0.06] bg-white p-6 sm:p-8">
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-[#666]">Request data deletion</div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Contact support</h2>
        <p className="mt-3 max-w-[70ch] text-[15px] text-[#111]/85">
          Send an email to{" "}
          <a className="font-medium text-[#2563eb] transition-colors duration-150 hover:text-[#1d4ed8]" href="mailto:support@optima.ai">
            support@optima.ai
          </a>{" "}
          with the information below. Requests are processed within <span className="font-semibold">72 hours</span>.
        </p>

        <div className="mt-6 border-t border-black/[0.06] pt-6">
          <div className="text-sm font-semibold">Include:</div>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] text-[#111]/85">
            <li>Account name</li>
            <li>Email used</li>
            <li>WhatsApp number</li>
          </ul>
        </div>

        <div className="mt-6 border-t border-black/[0.06] pt-6 text-[15px] text-[#111]/85">
          Once your request is validated, all associated data is deleted from our systems.
        </div>

        <div className="mt-7">
          <a
            href="mailto:support@optima.ai?subject=Data%20deletion%20request"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#2563eb] px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/25"
          >
            Contact support
          </a>
        </div>
      </section>
    </main>
  );
}

