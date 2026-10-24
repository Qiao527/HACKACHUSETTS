'use client';

import Link from 'next/link';
import { ScenarioProvider, useScenario } from './ScenarioProvider';

const STEPS = [
  { href: '/evidence', label: 'A · Evidence' },
  { href: '/timing', label: 'B · Timing' },
  { href: '/value', label: 'C · Value' },
  { href: '/brief', label: 'D · Brief' },
];

function StepNav({ current }: { current: string }) {
  const { recalculating } = useScenario();
  return (
    <div className="flex flex-wrap items-center gap-2 no-print">
      {STEPS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          aria-current={s.href === current ? 'step' : undefined}
          className={`pill h-9 text-sm ${s.href === current ? 'pill-primary' : 'pill-tint'}`}
        >
          {s.label}
        </Link>
      ))}
      <span
        className="ml-auto text-xs text-ink-secondary"
        aria-live="polite"
        style={{ minWidth: 90, textAlign: 'right' }}
      >
        {recalculating ? 'recalculating…' : 'up to date'}
      </span>
    </div>
  );
}

export function DemoShell({
  current,
  title,
  intro,
  children,
}: {
  current: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <ScenarioProvider>
      <div className="mx-auto max-w-content px-4 py-10 sm:px-8">
        <StepNav current={current} />
        <header className="mt-6">
          <h1 className="h1">{title}</h1>
          <p className="lead mt-2 max-w-3xl text-ink-secondary">{intro}</p>
        </header>
        <div className="mt-8">{children}</div>
      </div>
    </ScenarioProvider>
  );
}

// Small helper for pages to render loading/error consistently.
export function ScenarioGate({ children }: { children: React.ReactNode }) {
  const { loading, error } = useScenario();
  if (error)
    return (
      <div className="rounded-md bg-[#b4324a0f] p-5 text-danger">
        Could not reach the engine API: {error}
        <p className="mt-2 text-sm text-ink-secondary">
          Make sure the Python API is running (<code>npm run dev</code> starts both).
        </p>
      </div>
    );
  if (loading) return <p className="text-ink-secondary">Loading Harbor Loom Warehouse (fictional)…</p>;
  return <>{children}</>;
}
