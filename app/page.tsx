import Link from 'next/link';
import { HowItWorksDiagram } from './components/HowItWorksDiagram';

const ARTICLES = [
  {
    source: 'NYC government',
    title: 'A Model Energy Aligned Lease Provision',
    href: 'https://www.nyc.gov/html/planyc2030/downloads/pdf/110517a_energy_aligned_lease_official_packet.pdf',
    summary: 'Explains the split incentive: a building owner may fund an upgrade while occupants receive much of the energy savings, and shows how lease language can better align the two.',
  },
  {
    source: 'U.S. Department of Energy / GovInfo',
    title: 'Promoting Solar PV on Leased Buildings',
    href: 'https://www.govinfo.gov/content/pkg/GOVPUB-E-PURL-gpo160125/pdf/GOVPUB-E-PURL-gpo160125.pdf',
    summary: 'A practical guide to the ownership, lease, financing, and utility questions that make solar on leased commercial property different from owner-occupied projects.',
  },
  {
    source: 'UC Davis',
    title: 'Commercial Split Incentives and Electricity Use',
    href: 'https://rapson.ucdavis.edu/uploads/8/4/7/1/84716372/commercial_split_incentives_jpr.pdf',
    summary: 'Research showing that lease and bill structures can weaken incentives to invest in or conserve energy—even when the building could benefit overall.',
  },
  {
    source: 'Advanced Global Technology',
    title: 'Solar Panel Removal for Roof Replacement',
    href: 'https://www.agt.com/solar-panel-removal-for-roof-replacement/',
    summary: 'Describes why removing an array for roof work is a real construction project involving electrical work, warranties, permits, scheduling, and lost production.',
  },
  {
    source: 'Massachusetts Department of Energy Resources',
    title: 'SMART 3.0 Program Details',
    href: 'https://www.mass.gov/info-details/smart-30-program-details',
    summary: 'The current state source for Massachusetts solar incentive rules. SolarAlign flags these as factors to verify rather than assuming eligibility or adding them to results.',
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden bg-mint-soft px-4 py-section sm:px-8">
        <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-mint-accent/30" aria-hidden />
        <div className="relative mx-auto max-w-content">
          <p className="eyebrow text-primary">Solar project readiness · evidence · timing · shared value</p>
          <h1 className="display mt-4 max-w-4xl text-ink">Make the missing pieces of a rooftop solar project visible.</h1>
          <p className="lead mt-6 max-w-3xl text-ink-secondary">
            SolarAlign helps building teams gather the right facts, understand how roof timing changes a project, and explore ways solar value can reach the people and organizations needed to move installation forward.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/analyze" className="pill pill-primary">Start an analysis</Link>
            <a href="/solaralign-field-worksheet.pdf" download className="pill pill-tint">Download the field worksheet</a>
          </div>
          <p className="mt-5 max-w-2xl text-sm text-ink-secondary">No demo assumptions are inserted. Start with your own information, clearly label estimates, and keep unresolved questions visible.</p>
        </div>
      </section>

      <section className="px-4 py-section sm:px-8">
        <div className="mx-auto max-w-content">
          <p className="eyebrow text-primary">Why promising projects stall</p>
          <h2 className="h1 mt-3 max-w-3xl">A good solar resource is only one part of a buildable project.</h2>
          <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <Problem title="The roof has its own clock" body="Panels may last longer than the roof below them. Installing now can create future removal cost and downtime; waiting can give up years of clean generation." />
            <Problem title="Critical facts live in different places" body="Roof reports, proposals, utility bills, leases, and facilities knowledge rarely arrive in one consistent, source-backed package." />
            <Problem title="Value can land in the wrong place" body="The organization funding a project and the people receiving bill savings may be different. A project can help the building overall but still lack a workable path forward." />
            <Problem title="Incentives do not erase uncertainty" body="Programs can materially change economics, but eligibility, rate class, metering, structure, and consent must be verified rather than assumed." />
          </div>
        </div>
      </section>

      <section className="bg-mint-wash px-4 py-section sm:px-8">
        <div className="mx-auto max-w-content">
          <p className="eyebrow text-primary">How SolarAlign works</p>
          <h2 className="h1 mt-3 max-w-3xl">From scattered documents to a transparent next step.</h2>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-secondary">
            Start by entering facts or extracting selectable text from a PDF. SolarAlign keeps the source document available, separates cited facts from assumptions, and sends a complete set of inputs to a deterministic engine. The engine compares three ways to coordinate roof and solar work, then shows how usable value could support both project investment and building users. The final brief records outcomes and the questions still blocking adoption.
          </p>
          <div className="mt-8"><HowItWorksDiagram /></div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Definition term="NPV — Net Present Value" text="The value today of all modeled future project-side cash inflows and outflows. A positive NPV means the modeled benefits exceed costs after accounting for timing and the discount rate." />
            <Definition term="Positive-Outcome Range" text="The range of value-sharing assumptions where both the project-side NPV and first-full-year building-user savings are above zero. It is a starting point, not an agreement." />
            <Definition term="Provenance" text="The trail back to a source. For document-extracted facts, SolarAlign keeps the PDF name, page number, exact quote, and review status beside the value." />
          </div>
        </div>
      </section>

      <section className="px-4 py-section sm:px-8">
        <div className="mx-auto max-w-content">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-primary">Read the underlying problem</p>
              <h2 className="h1 mt-3 max-w-3xl">Articles, research, and public guidance</h2>
            </div>
            <p className="max-w-md text-sm text-ink-secondary">These sources show that roof coordination and split incentives are real deployment barriers. Linked sources remain responsible for their own guidance and figures.</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {ARTICLES.map((article) => (
              <a key={article.href} href={article.href} target="_blank" rel="noreferrer" className="group rounded-xl border border-mint-border bg-white p-5 transition hover:-translate-y-0.5 hover:bg-mint-soft">
                <p className="eyebrow text-primary">{article.source}</p>
                <h3 className="mt-2 text-xl font-medium text-ink group-hover:text-primary">{article.title} ↗</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{article.summary}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-section sm:px-8">
        <div className="mx-auto flex max-w-content flex-col items-start justify-between gap-5 rounded-2xl bg-night p-8 text-on-dark sm:flex-row sm:items-center sm:p-10">
          <div>
            <p className="eyebrow text-mint-accent">Ready to organize a project?</p>
            <h2 className="h2 mt-2 max-w-2xl">Bring a PDF, enter the facts you have, or take the worksheet into the field.</h2>
          </div>
          <Link href="/analyze" className="pill pill-primary shrink-0">Open Analyze</Link>
        </div>
      </section>
    </div>
  );
}

function Problem({ title, body }: { title: string; body: string }) {
  return <article className="rounded-xl bg-mint-soft p-6"><span className="block h-2 w-10 rounded-full bg-mint-accent" aria-hidden /><h3 className="mt-5 text-xl font-medium text-ink">{title}</h3><p className="mt-3 text-sm leading-relaxed text-ink-secondary">{body}</p></article>;
}

function Definition({ term, text }: { term: string; text: string }) {
  return <article className="rounded-xl border border-mint-border bg-white p-5"><h3 className="font-medium text-ink">{term}</h3><p className="mt-2 text-sm leading-relaxed text-ink-secondary">{text}</p></article>;
}
