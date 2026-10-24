'use client';
import Link from 'next/link';
import { DemoShell, ScenarioGate } from '../components/DemoShell';
import { RoofControls } from '../components/RoofControls';
import { ScheduleChart } from '../components/ScheduleChart';
import { useScenario } from '../components/ScenarioProvider';

function TimingBody() {
  const { input, result, recalculating, setInput } = useScenario();
  if (!input) return null;

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <div className="space-y-5">
        <RoofControls input={input} onChange={setInput} />
        <div className="rounded-md bg-lavender p-5 text-sm text-ink-secondary">
          <p className="eyebrow text-ink-secondary">Why timing matters</p>
          <p className="mt-2">
            If the roof must be replaced soon, panels installed now are removed and
            reinstalled during the work — an extra cost plus lost generation. Push the
            roof year out and the solar-now plan improves.
          </p>
        </div>
      </div>
      <div>
        <h2 className="h2 mb-3">Three plans vs. one roof-only baseline</h2>
        {result ? (
          <ScheduleChart result={result} />
        ) : (
          <p className="rounded-md bg-lavender p-5 text-sm text-ink-secondary" role="status">
            {recalculating ? 'Recalculating timing results for this roof year…' : 'Timing results are unavailable.'}
          </p>
        )}
        <div className="mt-6 no-print">
          <Link href="/value" className="pill pill-primary">
            Next: split the value →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function TimingPage() {
  return (
    <DemoShell
      current="/timing"
      title="Compare the timing"
      intro="Three roof/solar schedules measured against one roof-only baseline. Move the roof year and watch the owner’s incremental NPV change — recalculated by the engine, not the browser."
    >
      <ScenarioGate>
        <TimingBody />
      </ScenarioGate>
    </DemoShell>
  );
}
