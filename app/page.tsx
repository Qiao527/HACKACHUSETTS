import Link from 'next/link';

export default function HomePage() {
  return (
    <div>
      {/* Dark hero, framed by the night nav/footer. */}
      <section className="bg-night px-4 py-section text-on-dark sm:px-8">
        <div className="mx-auto max-w-content">
          <p className="eyebrow text-fog">Rooftop solar · split incentive · roof timing</p>
          <h1 className="display mt-4 max-w-3xl text-on-dark">
            The owner pays for the panels. The tenants keep the savings. Why would
            the owner proceed?
          </h1>
          <p className="lead mt-6 max-w-2xl text-fog">
            SolarAlign shows who pays, who benefits, and how roof timing changes a
            rooftop solar deal on an older multi-tenant building — with every input
            traced to evidence.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/evidence" className="pill pill-primary">
              Launch demo with Harbor Loom Warehouse
            </Link>
            <Link href="/value" className="pill pill-glass">
              Jump to the allocation
            </Link>
          </div>
          <div className="mt-10 grid max-w-3xl gap-6 sm:grid-cols-3">
            <Stat value="3" caption="roof/solar schedules vs. one baseline" />
            <Stat value="2" caption="metrics: owner NPV, tenant savings in first full operating year" />
            <Stat value="1" caption="Positive-Outcome Range (or an honest none)" />
          </div>
        </div>
      </section>
      {/* Light product section: the four steps. */}
      <section className="px-4 py-section sm:px-8">
        <div className="mx-auto max-w-content">
          <p className="eyebrow text-ink-secondary">How it works</p>
          <h2 className="h1 mt-3 max-w-2xl">
            Evidence first, deterministic math in the middle, AI only to explain.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <Step
              n="A"
              href="/evidence"
              title="Review evidence"
              body="An AI reads a synthetic roof report and extracts facts — each with a page number and an exact quote. You confirm or fix. No citation, no value."
            />
            <Step
              n="B"
              href="/timing"
              title="Compare timing"
              body="Edit the numbers and see three roof/solar schedules against one roof-only baseline. The engine recalculates instantly. The LLM never computes money."
            />
            <Step
              n="C"
              href="/value"
              title="Split the value"
              body="Move one slider between owner and tenants. The Positive-Outcome Range marks shares where owner NPV and tenant savings in the first full operating year are each above zero; it does not establish agreement."
            />
            <Step
              n="D"
              href="/brief"
              title="Print the brief"
              body="One page with both outcomes, the evidence, the assumptions, and the lease, meter and utility terms to confirm. Print to PDF."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ value, caption }: { value: string; caption: string }) {
  return (
    <div>
      <p className="text-on-dark" style={{ fontSize: 48, fontWeight: 480, lineHeight: 1.1 }}>
        {value}
      </p>
      <p className="mt-1 text-sm text-fog">{caption}</p>
    </div>
  );
}

function Step({
  n,
  href,
  title,
  body,
}: {
  n: string;
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-md bg-lavender p-8 transition hover:bg-[#e4e3fa]"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-white">
          {n}
        </span>
        <h3 className="h2">{title}</h3>
      </div>
      <p className="mt-3 text-ink-secondary" style={{ fontSize: 17, lineHeight: 1.4 }}>
        {body}
      </p>
    </Link>
  );
}
