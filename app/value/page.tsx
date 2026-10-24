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
      <p className="rounded-sm bg-lavender px-3 py-2 text-sm text-ink-secondary">
        <span className="eyebrow text-ink-secondary">Analyzed roof schedule</span>{' '}
        <span className="text-ink">{SCHEDULE_LABELS[ANALYZED_SCHEDULE]}</span>
      </p>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-md bg-surface p-6" style={{ border: '1px solid #ededf3' }}>
          <AllocationToggle input={input} result={result} onChange={setInput} />
        </div>
        <div>
          <AllocationChart input={input} inputRevision={inputRevision} />
        </div>
      </div>
      {result ? (
        <ProposalPanel result={result} inputRevision={inputRevision} />
      ) : (
        <section
          className="min-h-[220px] rounded-md bg-surface p-6"
          style={{ border: '1px solid #ededf3' }}
          role="status"
        >
          <p className="eyebrow text-ink-secondary">AI coordinator</p>
          <h3 className="h2 mt-1">Proposed allocation</h3>
          <p className="mt-4 text-sm text-ink-secondary">
            {recalculating
              ? 'Updating current scenario… Proposal generation is blocked until the current result is ready.'
              : 'Current financial results are unavailable, so proposal generation is blocked.'}
          </p>
        </section>
      )}
      <div className="no-print">
        <Link href="/brief" className="pill pill-primary">
          Next: the printable brief →
        </Link>
      </div>
    </div>
  );
}

export default function ValuePage() {
  return (
    <DemoShell
      current="/value"
      title="Who gets the value"
      intro="One slider moves value between owner and tenants. Separate charts show each outcome across every split and shade the Positive-Outcome Range where both metrics exceed zero. That range does not establish agreement."
    >
      <ScenarioGate>
        <ValueBody />
      </ScenarioGate>
    </DemoShell>
  );
}
