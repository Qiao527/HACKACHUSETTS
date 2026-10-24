'use client';

import type { EngineInput, EngineResult } from '../lib/contract';
import { formatContinuousPercent, getDecisionVerdict, wholePercentRange } from '../lib/decision-verdict';
import { money, pct, withScalar } from '../lib/format';
import { ANALYZED_SCHEDULE } from '../lib/scenario';

interface Props {
  input: EngineInput;
  result: EngineResult | null;
  onChange: (next: EngineInput) => void;
}

const VERDICT_COLOR = {
  positive: 'text-ok',
  negative: 'text-danger',
  warning: 'text-warn',
  updating: 'text-ink-secondary',
} as const;

// The slider explores how usable electricity value can reach both the project
// side and building users. It changes allocation, never generation.
export function AllocationToggle({ input, result, onChange }: Props) {
  const schedule = result?.results.find((item) => item.schedule === ANALYZED_SCHEDULE);
  const sharePercent = Math.round(input.tenant_share * 100);
  const projectPositive = (schedule?.owner_npv ?? 0) > 0;
  const userPositive = (schedule?.tenant_first_full_year_savings ?? 0) > 0;
  const verdict = getDecisionVerdict(result);
  const continuousRange = result?.mutual_benefit_range ?? null;
  const sliderRange = wholePercentRange(continuousRange);

  return (
    <div>
      <section className="rounded-xl bg-mint-soft p-4" aria-live="polite">
        <p className="eyebrow text-ink-secondary">Current modeled outcome</p>
        <p className={`mt-2 text-lg ${VERDICT_COLOR[verdict.tone]}`} style={{ fontWeight: 460 }}>{verdict.message}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-mint-border pt-3 text-xs">
          <p><span className="text-ink-secondary">Project / capital side</span><br /><span className="text-ink">Implementation terms not confirmed</span></p>
          <p><span className="text-ink-secondary">Building electricity users</span><br /><span className="text-ink">Participation not confirmed</span></p>
        </div>
        {continuousRange && (
          <div className="mt-3 space-y-1 text-xs text-ink-secondary">
            <p>Continuous model bounds: <span className="text-ink">{formatContinuousPercent(continuousRange[0])}–{formatContinuousPercent(continuousRange[1])}</span></p>
            <p>Whole-percentage slider positions: <span className="text-ink">{sliderRange ? `${sliderRange[0]}%–${sliderRange[1]}%` : 'none'}</span></p>
          </div>
        )}
      </section>

      <label htmlFor="tenant-share" className="eyebrow mt-5 block text-ink-secondary">
        Share of usable value reaching building users: {sharePercent}%
      </label>
      <input
        id="tenant-share"
        type="range"
        min={0}
        max={100}
        step={1}
        value={sharePercent}
        onChange={(event) => onChange(withScalar(input, 'tenant_share', Number(event.target.value) / 100))}
        className="mt-2 w-full accent-primary"
        aria-valuetext={`${sharePercent} percent of allocatable value to building electricity users`}
      />
      <div className="mt-1 flex justify-between text-xs text-ink-secondary"><span>Retained for project side</span><span>Available to building users</span></div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="min-h-[156px] rounded-xl bg-mint-soft p-5">
          <p className="eyebrow text-ink-secondary">Project / capital side</p>
          <p className="mt-1 text-sm text-ink-secondary">Incremental NPV over {input.horizon_years} years</p>
          {schedule ? (
            <>
              <p className={`mt-2 h2 ${projectPositive ? 'text-ok' : 'text-danger'}`}>{money(schedule.owner_npv)}</p>
              <p className="mt-1 text-xs text-ink-secondary">{projectPositive ? 'Modeled project-side economics are positive' : 'More value, lower cost, or different timing is needed'}</p>
            </>
          ) : <p className="mt-6 text-sm text-ink-secondary">Updating current project…</p>}
        </div>
        <div className="min-h-[156px] rounded-xl bg-mint-soft p-5">
          <p className="eyebrow text-ink-secondary">Building electricity users</p>
          <p className="mt-1 text-sm text-ink-secondary">Savings in the first full operating year</p>
          {schedule ? (
            <>
              <p className={`mt-2 h2 ${userPositive ? 'text-ok' : 'text-ink-secondary'}`}>{money(schedule.tenant_first_full_year_savings)}</p>
              <p className="mt-1 text-xs text-ink-secondary">{input.tenant_share === 0 ? 'No usable value reaches users in this scenario' : `${pct(input.tenant_share)} of allocatable value`}</p>
            </>
          ) : <p className="mt-6 text-sm text-ink-secondary">Updating current project…</p>}
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-secondary">Project-side NPV covers {input.horizon_years} years; building-user savings covers one operating year. Do not compare their dollar magnitudes or add them together.</p>
    </div>
  );
}
