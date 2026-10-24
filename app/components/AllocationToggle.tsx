'use client';
import type { EngineInput, EngineResult } from '../lib/contract';
import { SCHEDULE_LABELS } from '../lib/contract';
import { money, pct, withScalar } from '../lib/format';
import { ANALYZED_SCHEDULE } from '../lib/scenario';

interface Props {
  input: EngineInput;
  result: EngineResult | null;
  onChange: (next: EngineInput) => void;
}

// Owner ⇄ tenant: one slider moves value between the two; both outcomes always
// shown side by side (ui-rules.md). The slider is keyboard operable.
export function AllocationToggle({ input, result, onChange }: Props) {
  const sched = result?.results.find((item) => item.schedule === ANALYZED_SCHEDULE);
  const sharePct = Math.round(input.tenant_share * 100);
  const ownerPositive = (sched?.owner_npv ?? 0) > 0;
  const tenantPositive = (sched?.tenant_first_full_year_savings ?? 0) > 0;

  return (
    <div>
      <p className="mb-4 rounded-sm bg-lavender px-3 py-2 text-sm text-ink-secondary">
        <span className="eyebrow text-ink-secondary">Analyzed roof schedule</span>
        <br />
        <span className="text-ink">{SCHEDULE_LABELS[ANALYZED_SCHEDULE]}</span>
      </p>
      <label htmlFor="tenant-share" className="eyebrow text-ink-secondary">
        Tenant share of allocatable value: {sharePct}%
      </label>
      <input
        id="tenant-share"
        type="range"
        min={0}
        max={100}
        step={1}
        value={sharePct}
        onChange={(e) => onChange(withScalar(input, 'tenant_share', Number(e.target.value) / 100))}
        className="mt-2 w-full accent-primary"
        aria-valuetext={`${sharePct} percent to tenants`}
      />
      <div className="mt-1 flex justify-between text-xs text-ink-secondary">
        <span>All to owner</span>
        <span>All to tenants</span>
      </div>

      {sched ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md bg-lavender p-5">
            <p className="eyebrow text-ink-secondary">Owner</p>
            <p className="mt-1 text-sm text-ink-secondary">
              Incremental NPV over {input.horizon_years} years
            </p>
            <p className="mt-2 h2" style={{ color: ownerPositive ? '#2f8f5b' : '#b4324a' }}>
              {money(sched.owner_npv)}
            </p>
            <p className="mt-1 text-xs text-ink-secondary">
              {ownerPositive ? 'Positive for the owner' : 'Negative for the owner'} at this share
            </p>
          </div>
          <div className="rounded-md bg-lavender p-5">
            <p className="eyebrow text-ink-secondary">Tenants</p>
            <p className="mt-1 text-sm text-ink-secondary">First full operating year savings</p>
            <p className="mt-2 h2" style={{ color: tenantPositive ? '#2f8f5b' : '#554e7b' }}>
              {money(sched.tenant_first_full_year_savings)}
            </p>
            <p className="mt-1 text-xs text-ink-secondary">
              {input.tenant_share === 0
                ? 'Nothing allocated to tenants'
                : `${pct(input.tenant_share)} of allocatable value`}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-md bg-lavender p-5 text-sm text-ink-secondary" role="status">
          Recalculating owner and tenant outcomes for this input…
        </p>
      )}

      <p className="mt-3 text-xs text-ink-secondary">
        Owner NPV covers {input.horizon_years} years; tenant savings covers one operating year.
        Do not compare their dollar magnitudes or add them together.
      </p>
    </div>
  );
}
