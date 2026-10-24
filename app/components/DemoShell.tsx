'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';
import { useScenario } from './ScenarioProvider';

const STEPS = [
  { href: '/analyze', label: 'A · Analyze' },
  { href: '/evidence', label: 'B · Sources' },
  { href: '/timing', label: 'C · Timing' },
  { href: '/value', label: 'D · Align value' },
  { href: '/brief', label: 'E · Brief' },
];

function StepNav({ current }: { current: string }) {
  const { input, recalculating, error } = useScenario();
  return (
    <div className="flex flex-wrap items-center gap-2 no-print">
      {STEPS.map((step) => (
        <Link
          key={step.href}
          href={step.href}
          aria-current={step.href === current ? 'step' : undefined}
          className={`pill h-9 text-sm ${step.href === current ? 'pill-primary' : 'pill-tint'}`}
        >
          {step.label}
        </Link>
      ))}
      <span className="ml-auto text-xs text-ink-secondary" aria-live="polite" style={{ minWidth: 105, textAlign: 'right' }}>
        {error ? 'update failed' : recalculating ? 'calculating…' : input ? 'analysis ready' : 'no inputs yet'}
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
  const router = useRouter();

  // Keep any legacy internal anchors on client-side navigation so the root
  // provider (including the retained PDF object URL) stays mounted.
  function handleInternalNavigation(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest('a');
    const href = anchor?.getAttribute('href');
    if (!anchor || !href?.startsWith('/') || href.startsWith('//') || anchor.target || anchor.hasAttribute('download')) return;
    event.preventDefault();
    router.push(href);
  }

  return (
    <div className="mx-auto max-w-content px-4 py-10 sm:px-8" onClick={handleInternalNavigation}>
      <StepNav current={current} />
      <header className="no-print mt-7 max-w-4xl">
        <h1 className="h1">{title}</h1>
        <p className="lead mt-2 text-ink-secondary">{intro}</p>
      </header>
      <div className="mt-8">{children}</div>
    </div>
  );
}

export function ScenarioGate({ children }: { children: React.ReactNode }) {
  const { input, loading, error } = useScenario();
  if (loading) {
    return <p className="rounded-xl bg-mint-soft p-5 text-ink-secondary" role="status">Restoring your analysis…</p>;
  }
  if (!input) {
    return (
      <section className="rounded-xl border border-mint-border bg-mint-soft p-7">
        <p className="eyebrow text-primary">Start with project facts</p>
        <h2 className="h2 mt-2">This calculation is intentionally empty.</h2>
        <p className="mt-3 max-w-2xl text-ink-secondary">
          SolarAlign no longer inserts a demo building or hidden assumptions. Enter the roof, production, cost, and value information for the project you want to evaluate.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/analyze" className="pill pill-primary">Enter or extract project data</Link>
          <a href="/solaralign-field-worksheet.pdf" download className="pill pill-tint">Download field worksheet</a>
        </div>
      </section>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl bg-danger-soft p-5 text-danger">
        The calculation could not be updated: {error}
        <p className="mt-2 text-sm text-ink-secondary">Review the input fields in Analyze and try again. For local development, make sure the Python API is running.</p>
        <Link href="/analyze" className="pill pill-tint mt-4">Review inputs</Link>
      </div>
    );
  }
  return <>{children}</>;
}
