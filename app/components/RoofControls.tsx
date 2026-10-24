'use client';

import type { EngineInput } from '../lib/contract';
import { money } from '../lib/format';

interface Props { input: EngineInput; onChange: (next: EngineInput) => void; }

export function RoofControls({ input, onChange }: Props) {
  const year = input.roof_replacement_year.value ?? 0;
  function setRoofYear(next: number) {
    onChange({
      ...input,
      roof_replacement_year: {
        ...input.roof_replacement_year,
        value: next,
        status: 'human_supplied',
        evidence: null,
        confirmed_by_user: true,
      },
    });
  }

  return (
    <div className="rounded-xl border border-mint-border bg-surface p-5">
      <p className="eyebrow text-primary">Test roof timing</p>
      <label htmlFor="roof-year" className="mt-2 block text-sm">Planned roof replacement: <strong>{year <= 0 ? 'now' : `in ${year} year${year === 1 ? '' : 's'}`}</strong></label>
      <input id="roof-year" type="range" min={0} max={Math.min(20, input.horizon_years)} step={1} value={year} onChange={(event) => setRoofYear(Number(event.target.value))} className="mt-2 w-full accent-primary" aria-valuetext={year <= 0 ? 'roof replaced now' : `roof replaced in ${year} years`} />
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-ink-secondary">Roof replacement</dt><dd className="font-medium">{money(input.roof_replacement_cost.value)}</dd></div>
        <div><dt className="text-ink-secondary">Detach and reset array</dt><dd className="font-medium">{money(input.removal_reinstall_cost.value)}</dd></div>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-ink-secondary">If solar goes first, roof work triggers the removal/reinstallation cost and loses {Math.round(input.downtime_fraction * 100)}% of that year's production. Use this control to see whether coordination can keep the project viable.</p>
    </div>
  );
}
