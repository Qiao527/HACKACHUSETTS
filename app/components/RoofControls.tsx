'use client';

import type { EngineInput } from '../lib/contract';
import { money } from '../lib/format';

interface Props {
  input: EngineInput;
  onChange: (next: EngineInput) => void;
}

// Roof timing: the supporting variable. Moving the planned replacement year
// changes removal/reinstall exposure for the solar-now schedule. Re-calls the
// engine; the UI never computes the effect.
export function RoofControls({ input, onChange }: Props) {
  const year = input.roof_replacement_year.value ?? 0;

  function setRoofYear(next: number) {
    const field = {
      ...input.roof_replacement_year,
      value: next,
      status: 'human_supplied' as const,
      confirmed_by_user: true,
    };
    onChange({ ...input, roof_replacement_year: field });
  }

  return (
    <div className="rounded-md bg-surface p-5" style={{ border: '1px solid #ededf3' }}>
      <p className="eyebrow text-ink-secondary">Roof timing</p>
      <label htmlFor="roof-year" className="mt-2 block text-sm">
        Planned roof replacement:{' '}
        <strong>
          {year <= 0 ? 'now' : `in ${year} year${year === 1 ? '' : 's'}`}
        </strong>
      </label>
      <input
        id="roof-year"
        type="range"
        min={0}
        max={Math.min(20, input.horizon_years)}
        step={1}
        value={year}
        onChange={(e) => setRoofYear(Number(e.target.value))}
        className="mt-2 w-full accent-primary"
        aria-valuetext={year <= 0 ? 'roof replaced now' : `roof replaced in ${year} years`}
      />
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-ink-secondary">Roof replacement cost</dt>
          <dd style={{ fontWeight: 460 }}>{money(input.roof_replacement_cost.value)}</dd>
        </div>
        <div>
          <dt className="text-ink-secondary">Remove &amp; reinstall array</dt>
          <dd style={{ fontWeight: 460 }}>{money(input.removal_reinstall_cost.value)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-ink-secondary">
        Earlier roof work means the array is removed and reinstalled sooner, with
        {' '}{Math.round(input.downtime_fraction * 100)}% of that year’s generation lost to downtime.
      </p>
    </div>
  );
}
