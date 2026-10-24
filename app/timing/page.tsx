'use client';

import Link from 'next/link';
import { DemoShell, ScenarioGate } from '../components/DemoShell';
import { RoofControls } from '../components/RoofControls';
import { ScheduleChart } from '../components/ScheduleChart';
import { useScenario } from '../components/ScenarioProvider';

function TimingBody() {
  const { input, result, recalculating, setInput, retireExtractedField } = useScenario();
  if (!input) return null;
  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <div className="space-y-5">
        <RoofControls input={input} onChange={(next) => {
          retireExtractedField('roof_replacement_year');
          setInput(next);
        }} />
        <div className="rounded-xl bg-mint-soft p-5 text-sm leading-relaxed text-ink-secondary">
          <p className="eyebrow text-primary">Why timing matters</p>
          <p className="mt-2">Solar panels and roofs have different lifecycles. Coordinating them can avoid a detach-and-reset project, protect roof warranties, reduce downtime, and make better use of capital—while waiting too long can sacrifice clean-energy production.</p>
        </div>
        <Link href="/analyze" className="inline-block text-sm font-medium text-primary">Review or replace inputs →</Link>
      </div>
      <div>
        <h2 className="h2 mb-3">Three pathways vs. a roof-only baseline</h2>
        {result ? <ScheduleChart result={result} /> : <p className="rounded-xl bg-mint-soft p-5 text-sm text-ink-secondary" role="status">{recalculating ? 'Recalculating pathways for this roof year…' : 'Timing results are unavailable.'}</p>}
        <div className="mt-6 no-print"><Link href="/value" className="pill pill-primary">Next: align project value →</Link></div>
      </div>
    </div>
  );
}

export default function TimingPage() {
  return (
    <DemoShell current="/timing" title="Compare roof and solar timing" intro="Test whether solar should move now, be installed alongside roof work, or wait for the planned roof year. The deterministic engine compares each pathway with the same roof-only baseline.">
      <ScenarioGate><TimingBody /></ScenarioGate>
    </DemoShell>
  );
}
