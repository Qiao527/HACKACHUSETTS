'use client';
import type { EngineInput, EngineResult, InputField } from '../lib/contract';
import { SCHEDULE_LABELS } from '../lib/contract';
import { money, pct } from '../lib/format';
import { ANALYZED_SCHEDULE } from '../lib/scenario';
import { LegalLabels, SourceBadge } from './Badges';
import { ScheduleChart } from './ScheduleChart';

interface Props {
  input: EngineInput;
  result: EngineResult;
}

// One printable page: both stakeholder outcomes, evidence, assumptions, next
// actions. Print -> PDF via the browser.
export function BriefLayout({ input, result }: Props) {
  const sched = result.results.find((item) => item.schedule === ANALYZED_SCHEDULE);
  const zone = result.mutual_benefit_range;
  const facts: InputField[] = [
    input.roof_replacement_year,
    input.roof_replacement_cost,
    input.removal_reinstall_cost,
    input.annual_kwh,
    input.electricity_value_per_kwh,
  ];

  if (!sched) {
    return <p className="text-danger">The analyzed roof schedule is unavailable.</p>;
  }

  return (
    <article
      className="brief-page mx-auto max-w-[820px] bg-surface p-8"
      style={{ border: '1px solid #ededf3', borderRadius: 12 }}
    >
      <header className="flex items-start justify-between">
        <div>
          <p className="eyebrow text-ink-secondary">Decision brief</p>
          <h1 className="h1 mt-1">Rooftop solar — owner &amp; tenant outcomes</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Harbor Loom Warehouse · fictional multi-tenant warehouse, East Boston · scenario {result.scenario_id}
          </p>
          <p className="mt-2 text-sm text-ink-secondary">
            <span className="eyebrow text-ink-secondary">Analyzed roof schedule</span>
            <br />
            <span className="text-ink">{SCHEDULE_LABELS[ANALYZED_SCHEDULE]}</span>
          </p>
        </div>
        <span className="badge border-warn text-warn bg-[#9a6a0014]">◆ synthetic</span>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-md bg-lavender p-4">
          <p className="eyebrow text-ink-secondary">Owner</p>
          <p className="h2 mt-1" style={{ color: sched.owner_npv > 0 ? '#2f8f5b' : '#b4324a' }}>
            {money(sched.owner_npv)}
          </p>
          <p className="text-xs text-ink-secondary">
            Incremental NPV over {input.horizon_years} years at {pct(input.tenant_share)} tenant share
          </p>
        </div>
        <div className="rounded-md bg-lavender p-4">
          <p className="eyebrow text-ink-secondary">Tenants</p>
          <p
            className="h2 mt-1"
            style={{ color: sched.tenant_first_full_year_savings > 0 ? '#2f8f5b' : '#554e7b' }}
          >
            {money(sched.tenant_first_full_year_savings)}
          </p>
          <p className="text-xs text-ink-secondary">First full operating year savings</p>
        </div>
      </section>
      <p className="mt-2 text-xs text-ink-secondary">
        Owner NPV covers {input.horizon_years} years; tenant savings covers one operating year.
        Their dollar magnitudes are not directly comparable and are not added together.
      </p>

      <section className="mt-6">
        <h2 className="eyebrow text-ink-secondary">Positive-Outcome Range</h2>
        {zone ? (
          <p className="mt-1 text-sm">
            For the analyzed schedule, owner incremental NPV and tenant first-full-year savings are
            each greater than zero when tenant share is between <strong>{pct(zone[0])}</strong> and{' '}
            <strong>{pct(zone[1])}</strong>. This does not establish actual owner–tenant agreement.
          </p>
        ) : (
          <p className="mt-1 text-sm text-warn">
            No tenant share makes both financial metrics positive for the analyzed schedule.
            Allocation redistributes value; it cannot create value, and this result does not decide
            whether the parties can reach agreement.
          </p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="eyebrow text-ink-secondary">Roof timing — three plans vs. baseline</h2>
        <div className="mt-2">
          <ScheduleChart result={result} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="eyebrow text-ink-secondary">Evidence &amp; assumptions</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {facts.map((field) => (
            <li key={field.field} className="flex items-start justify-between gap-3">
              <span>
                <strong className="capitalize">{field.field.replace(/_/g, ' ')}:</strong>{' '}
                {field.value_range
                  ? `${field.value_range[0]}–${field.value_range[1]} ${field.unit}`
                  : `${field.value != null ? field.value.toLocaleString('en-US') : '—'} ${field.unit}`}
                {field.evidence && (
                  <span className="text-ink-secondary">
                    {' '}— “{field.evidence.evidence_text}” ({field.evidence.document_id}, p.{field.evidence.page})
                  </span>
                )}
              </span>
              {field.evidence && <SourceBadge source={field.evidence.source_type} />}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="eyebrow text-ink-secondary">What must be confirmed next</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-secondary">
          <li>Roof rights and who holds capital responsibility for the roof and array.</li>
          <li>Meter topology and the account holders behind each meter.</li>
          <li>Utility territory, rate class, and any credit-allocation restrictions.</li>
          <li>Lease duration, tenant consent, and how charges and savings are treated.</li>
        </ul>
      </section>

      <footer className="mt-6 border-t pt-4 text-xs text-ink-secondary" style={{ borderColor: '#ededf3' }}>
        <div className="mb-2">
          <LegalLabels />
        </div>
        <p>
          {result.notes.join(' ')} Engine {result.model_version}. The building, roof
          report, tenancy and meter facts are synthetic (demo_pca.pdf). Production comes
          from a cached NREL PVWatts V8 run; costs are labeled assumptions in 2024 dollars.
        </p>
      </footer>
    </article>
  );
}
