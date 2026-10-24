export function SiteFooter() {
  return (
    <footer className="bg-night px-4 py-10 text-fog sm:px-8 no-print">
      <div className="mx-auto max-w-content">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="text-on-dark" style={{ fontWeight: 480 }}>
              SolarAlign
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              Why a financially promising rooftop solar project stalls on older
              multi-tenant buildings — and whether an allocation benefits both
              owner and tenants.
            </p>
          </div>
          <div>
            <p className="eyebrow text-on-dark">Data sources</p>
            <ul className="mt-3 space-y-1 text-sm">
              <li>NREL PVWatts V8</li>
              <li>U.S. DOE PV cost benchmarks</li>
              <li>Mass.gov SMART 3.0 · Boston BERDO</li>
            </ul>
          </div>
          <div>
            <p className="eyebrow text-on-dark">Labels</p>
            <ul className="mt-3 space-y-1 text-sm">
              <li>Synthetic inputs are labeled in the app.</li>
              <li>Not legal advice.</li>
              <li>Eligibility not verified.</li>
              <li>Incentives shown as “may change the result,” not calculated.</li>
            </ul>
          </div>
        </div>
        <p className="mt-8 border-t border-slate pt-4 text-xs leading-relaxed">
          SolarAlign is a demonstration built at Hackachusetts 2026. The demo
          building (Harbor Loom Warehouse), its roof report, tenancy and meter facts
          are synthetic. Only the engine computes money;
          the assistant copies engine numbers unchanged and never invents them.
        </p>
      </div>
    </footer>
  );
}
