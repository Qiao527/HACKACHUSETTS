import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="no-print bg-night px-4 py-10 text-fog sm:px-8">
      <div className="mx-auto max-w-content">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="text-on-dark" style={{ fontWeight: 480 }}>SolarAlign</p>
            <p className="mt-2 text-sm leading-relaxed">Evidence and decision support for moving more viable rooftop solar projects from interest to action.</p>
          </div>
          <div>
            <p className="eyebrow text-on-dark">Use the tools</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/analyze" className="hover:text-on-dark">Analyze a project</Link></li>
              <li><Link href="/field-form" className="hover:text-on-dark">Preview field worksheet</Link></li>
              <li><a href="/solaralign-field-worksheet.pdf" download className="hover:text-on-dark">Download worksheet PDF</a></li>
            </ul>
          </div>
          <div>
            <p className="eyebrow text-on-dark">Boundaries</p>
            <ul className="mt-3 space-y-1 text-sm">
              <li>Estimates and assumptions stay labeled.</li>
              <li>Not legal, structural, or tax advice.</li>
              <li>Eligibility is not verified.</li>
              <li>Incentives may change results but are not assumed.</li>
            </ul>
          </div>
        </div>
        <p className="mt-8 border-t border-slate pt-4 text-xs leading-relaxed">SolarAlign is a decision-support prototype built at Hackachusetts 2026. AI may locate source passages and draft explanations; deterministic Python code owns every financial calculation.</p>
      </div>
    </footer>
  );
}
