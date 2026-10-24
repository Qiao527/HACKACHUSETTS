'use client';
import { BriefLayout } from '../components/BriefLayout';
import { DemoShell, ScenarioGate } from '../components/DemoShell';
import { useScenario } from '../components/ScenarioProvider';

function BriefBody() {
  const { input, result, recalculating } = useScenario();
  if (!input) return null;
  if (!result) {
    return (
      <p className="rounded-md bg-lavender p-5 text-sm text-ink-secondary" role="status">
        {recalculating
          ? 'Recalculating financial results. The printable brief is blocked until the current result is ready…'
          : 'The printable brief is unavailable because no current financial result exists.'}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-5 flex justify-end no-print">
        <button type="button" className="pill pill-primary" onClick={() => window.print()}>
          Print → PDF
        </button>
      </div>
      <BriefLayout input={input} result={result} />
    </div>
  );
}

export default function BriefPage() {
  return (
    <DemoShell
      current="/brief"
      title="The decision brief"
      intro="One page for the owner and the tenants: both outcomes, the evidence behind them, the assumptions, and what must be confirmed before anything is signed."
    >
      <ScenarioGate>
        <BriefBody />
      </ScenarioGate>
    </DemoShell>
  );
}
