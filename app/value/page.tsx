'use client';

import { AllocationChart } from '../components/AllocationChart';
import { AllocationToggle } from '../components/AllocationToggle';
import { DemoShell, ScenarioGate } from '../components/DemoShell';
import { ProposalPanel } from '../components/ProposalPanel';
import { useScenario } from '../components/ScenarioProvider';

function ValueBody() {
  const { input, result, setInput } = useScenario();
  if (!input || !result) return null;

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-md bg-surface p-6" style={{ border: '1px solid #ededf3' }}>
          <AllocationToggle input={input} result={result} onChange={setInput} />
        </div>
        <div>
          <AllocationChart input={input} />
        </div>
      </div>
      <ProposalPanel result={result} />
      <div className="no-print">
        <a href="/brief" className="pill pill-primary">
          Next: the printable brief →
        </a>
      </div>
    </div>
  );
}

export default function ValuePage() {
  return (
    <DemoShell
      current="/value"
      title="Who gets the value"
      intro="One slider moves value between owner and tenants. The chart shows both outcomes across every split and shades the band where both come out positive — or tells you honestly when none exists."
    >
      <ScenarioGate>
        <ValueBody />
      </ScenarioGate>
    </DemoShell>
  );
}
