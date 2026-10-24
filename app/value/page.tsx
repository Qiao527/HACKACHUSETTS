'use client';

import Link from 'next/link';
import { AllocationChart } from '../components/AllocationChart';
import { AllocationToggle } from '../components/AllocationToggle';
import { DemoShell, ScenarioGate } from '../components/DemoShell';
import { ProposalPanel } from '../components/ProposalPanel';
import { useScenario } from '../components/ScenarioProvider';
import { SCHEDULE_LABELS } from '../lib/contract';
import { ANALYZED_SCHEDULE } from '../lib/scenario';

function ValueBody() {
  const { input, result, inputRevision, recalculating, setInput } = useScenario();
  if (!input) return null;
  return (
    <div className="space-y-8">
      <p className="rounded-xl bg-mint-soft px-4 py-3 text-sm text-ink-secondary"><span className="eyebrow text-primary">Pathway analyzed for value alignment</span>{' '}<span className="text-ink">{SCHEDULE_LABELS[ANALYZED_SCHEDULE]}</span></p>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-mint-border bg-surface p-6"><AllocationToggle input={input} result={result} onChange={setInput} /></div>
        <AllocationChart input={input} inputRevision={inputRevision} />
      </div>
      {result ? <ProposalPanel result={result} inputRevision={inputRevision} /> : (
        <section className="min-h-[220px] rounded-xl border border-mint-border bg-surface p-6" role="status">
          <p className="eyebrow text-primary">Optional AI explanation</p><h3 className="h2 mt-1">Translate results into next-step language</h3>
          <p className="mt-4 text-sm text-ink-secondary">{recalculating ? 'Updating the project… Explanation drafting is paused until the current result is ready.' : 'Current financial results are unavailable, so explanation drafting is paused.'}</p>
        </section>
      )}
      <div className="no-print"><Link href="/brief" className="pill pill-primary">Next: create the project brief →</Link></div>
    </div>
  );
}

export default function ValuePage() {
  return (
    <DemoShell current="/value" title="Align project value" intro="Explore how usable solar value could support both the organizations investing in the project and the building users who experience its energy benefits. The range is a planning tool—not a contract or consent finding.">
      <ScenarioGate><ValueBody /></ScenarioGate>
    </DemoShell>
  );
}
