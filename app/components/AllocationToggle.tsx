'use client';
import type { EngineInput, EngineResult } from '../lib/contract';
import {
  formatContinuousPercent,
  getDecisionVerdict,
  wholePercentRange,
} from '../lib/decision-verdict';
import { money, pct, withScalar } from '../lib/format';
import { ANALYZED_SCHEDULE } from '../lib/scenario';

interface Props {
  input: EngineInput;
  result: EngineResult | null;
  onChange: (next: EngineInput) => void;
}

const VERDICT_COLOR = {
  positive: 'text-[#2f8f5b]',
  negative: 'text-danger',
  warning: 'text-warn',
  updating: 'text-ink-secondary',
} as const;

// Owner ⇄ tenant: one slider moves value between the two; both outcomes always
// shown side by side (ui-rules.md). The slider is keyboard operable.
export function AllocationToggle({ input, result, onChange }: Props) {
  const sched = result?.results.find((item) => item.schedule === ANALYZED_SCHEDULE);
  const sharePct = Math.round(input.tenant_share * 100);
  const ownerPositive = (sched?.owner_npv ?? 0) > 0;
  const tenantPositive = (sched?.tenant_first_full_year_savings ?? 0) > 0;
  const verdict = getDecisionVerdict(result);
  const continuousRange = result?.mutual_benefit_range ?? null;
  const sliderRange = wholePercentRange(continuousRange);

  return (
    <div>
      <section className="rounded-md bg-lavender p-4" aria-live="polite">
        <p className="eyebrow text-ink-secondary">Current modeled outcome</p>
        <p className={`mt-2 text-lg ${VERDICT_COLOR[verdict.tone]}`} style={{ fontWeight: 460 }}>
          {verdict.message}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-xs" style={{ borderColor: '#c3c3cc' }}>
          <p>
            <span className="text-ink-secondary">Owner</span>
            <br />
            <span className="text-ink">Agreement not confirmed</span>
          </p>
          <p>
            <span className="text-ink-secondary">Tenants</span>
            <br />
            <span className="text-ink">Agreement not confirmed</span>
          </p>
        </div>
        {continuousRange && (
          <div className="mt-3 space-y-1 text-xs text-ink-secondary">
            <p>
              Continuous engine bounds:{' '}
              <span className="text-ink">
                {formatContinuousPercent(continuousRange[0])}–
                {formatContinuousPercent(continuousRange[1])}
              </span>
            </p>
            <p>
              Whole-percentage slider positions:{' '}
              <span className="text-ink">
                {sliderRange ? `${sliderRange[0]}%–${sliderRange[1]}%` : 'none'}
              </span>
            </p>
          </div>
        )}
      </section>

      <label htmlFor="tenant-share" className="eyebrow mt-5 block text-ink-secondary">
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

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="min-h-[156px] rounded-md bg-lavender p-5">
          <p className="eyebrow text-ink-secondary">Owner</p>
          <p className="mt-1 text-sm text-ink-secondary">
            Incremental NPV over {input.horizon_years} years
          </p>
          {sched ? (
            <>
              <p className="mt-2 h2" style={{ color: ownerPositive ? '#2f8f5b' : '#b4324a' }}>
                {money(sched.owner_npv)}
              </p>
              <p className="mt-1 text-xs text-ink-secondary">
                {ownerPositive ? 'Positive for the owner' : 'Negative for the owner'} at this share
              </p>
            </>
          ) : (
            <p className="mt-6 text-sm text-ink-secondary">Updating current scenario…</p>
          )}
        </div>
        <div className="min-h-[156px] rounded-md bg-lavender p-5">
          <p className="eyebrow text-ink-secondary">Tenants</p>
          <p className="mt-1 text-sm text-ink-secondary">First full operating year savings</p>
          {sched ? (
            <>
              <p className="mt-2 h2" style={{ color: tenantPositive ? '#2f8f5b' : '#554e7b' }}>
                {money(sched.tenant_first_full_year_savings)}
              </p>
              <p className="mt-1 text-xs text-ink-secondary">
                {input.tenant_share === 0
                  ? 'Nothing allocated to tenants'
                  : `${pct(input.tenant_share)} of allocatable value`}
              </p>
            </>
          ) : (
            <p className="mt-6 text-sm text-ink-secondary">Updating current scenario…</p>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-secondary">
        Owner NPV covers {input.horizon_years} years; tenant savings covers one operating year.
        Do not compare their dollar magnitudes or add them together.
      </p>
    </div>
  );
}
