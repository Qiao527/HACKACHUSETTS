'use client';

import { BriefLayout } from '../components/BriefLayout';
import { DemoShell, ScenarioGate } from '../components/DemoShell';
import { useScenario } from '../components/ScenarioProvider';

function BriefBody() {
  const { input, result } = useScenario();
  if (!input || !result) return null;
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
