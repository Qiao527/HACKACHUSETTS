'use client';

import type { EngineInput, EngineResult, InputField } from '../lib/contract';
import { SCHEDULE_LABELS } from '../lib/contract';
import { money, pct } from '../lib/format';
import { ANALYZED_SCHEDULE } from '../lib/scenario';
import { FIELD_BY_KEY } from '../lib/fieldDefinitions';
import { LegalLabels, SourceBadge } from './Badges';
import { ScheduleChart } from './ScheduleChart';

interface Props {
  input: EngineInput;
  result: EngineResult;
  projectDetails?: Record<string, string>;
  sourceDocumentName?: string;
}

export function BriefLayout({ input, result, projectDetails = {}, sourceDocumentName }: Props) {
  const schedule = result.results.find((item) => item.schedule === ANALYZED_SCHEDULE);
  const zone = result.mutual_benefit_range;
  const facts: InputField[] = [
    input.roof_replacement_year,
    input.roof_replacement_cost,
    input.removal_reinstall_cost,
    input.annual_kwh,
    input.solar_capex,
    input.om_cost_per_year,
    input.electricity_value_per_kwh,
  ];
  if (!schedule) return <p className="text-danger">The analyzed roof schedule is unavailable.</p>;
  const projectName = projectDetails.project_name || result.scenario_id;
  const contextEntries = Object.entries(projectDetails).filter(
    ([key, value]) => !['project_name', 'building_address'].includes(key) && value.trim(),
  );

  return (
    <article className="brief-page mx-auto max-w-[840px] rounded-xl border border-mint-border bg-surface p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">Solar readiness brief</p>
          <h1 className="h1 mt-1">{projectName}</h1>
          {projectDetails.building_address && <p className="mt-1 text-sm text-ink-secondary">{projectDetails.building_address}</p>}
          <p className="mt-3 text-sm text-ink-secondary"><span className="eyebrow text-ink-secondary">Pathway analyzed</span><br /><span className="text-ink">{SCHEDULE_LABELS[ANALYZED_SCHEDULE]}</span></p>
        </div>
        <span className="badge border-primary bg-primary-soft text-primary">{sourceDocumentName ? `▣ Source: ${sourceDocumentName}` : 'Manual project inputs'}</span>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-mint-soft p-4">
          <p className="eyebrow text-ink-secondary">Project / capital side</p>
          <p className={`h2 mt-1 ${schedule.owner_npv > 0 ? 'text-ok' : 'text-danger'}`}>{money(schedule.owner_npv)}</p>
          <p className="text-xs text-ink-secondary">Incremental NPV over {input.horizon_years} years at {pct(input.tenant_share)} building-user value share</p>
        </div>
        <div className="rounded-xl bg-mint-soft p-4">
          <p className="eyebrow text-ink-secondary">Building electricity users</p>
          <p className={`h2 mt-1 ${schedule.tenant_first_full_year_savings > 0 ? 'text-ok' : 'text-ink-secondary'}`}>{money(schedule.tenant_first_full_year_savings)}</p>
          <p className="text-xs text-ink-secondary">Savings in the first full operating year</p>
        </div>
      </section>
      <p className="mt-2 text-xs text-ink-secondary">NPV spans {input.horizon_years} years; building-user savings covers one operating year. The figures are not added together.</p>

      <section className="mt-6">
        <h2 className="eyebrow text-primary">Positive-Outcome Range</h2>
        {zone ? <p className="mt-1 text-sm">Both modeled outcomes are above zero when the building-user share is between <strong>{pct(zone[0])}</strong> and <strong>{pct(zone[1])}</strong>. This identifies a planning range; it does not establish consent, a lease term, or utility eligibility.</p> : <p className="mt-1 text-sm text-warn">No value share makes both modeled outcomes positive for this pathway and these inputs. Revisit cost, production, timing, and usable electricity value before concluding that the solar opportunity should stop.</p>}
      </section>

      <section className="mt-6">
        <h2 className="eyebrow text-primary">Roof and solar timing</h2>
        <div className="mt-2"><ScheduleChart result={result} /></div>
      </section>

      {contextEntries.length > 0 && (
        <section className="mt-6 break-inside-avoid">
          <h2 className="eyebrow text-primary">Project readiness context</h2>
          <dl className="mt-2 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
            {contextEntries.map(([key, value]) => (
              <div key={key} className="border-b border-mint-border pb-1">
                <dt className="text-xs text-ink-secondary">{FIELD_BY_KEY.get(key)?.label ?? key.replace(/_/g, ' ')}</dt>
                <dd className="text-ink">{value}{FIELD_BY_KEY.get(key)?.unit ? ` ${FIELD_BY_KEY.get(key)?.unit}` : ''}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mt-6">
        <h2 className="eyebrow text-primary">Calculation inputs and evidence</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {facts.map((field) => (
            <li key={field.field} className="flex items-start justify-between gap-3 border-b border-mint-border pb-2">
              <span><strong className="capitalize">{field.field.replace(/_/g, ' ')}:</strong>{' '}{field.value_range ? `${field.value_range[0]}–${field.value_range[1]} ${field.unit}` : `${field.value != null ? field.value.toLocaleString('en-US') : '—'} ${field.unit}`}{field.evidence && <span className="text-ink-secondary"> — “{field.evidence.evidence_text}” ({field.evidence.document_id}, p.{field.evidence.page})</span>}</span>
              {field.evidence && <SourceBadge source={field.evidence.source_type} />}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-secondary">Other model settings: {Math.round(input.downtime_fraction * 100)}% roof-work downtime, {Math.round(input.unallocated_share * 100)}% unallocated value, {(input.discount_rate * 100).toFixed(2)}% discount rate, {(input.degradation * 100).toFixed(2)}% degradation, {(input.escalation_rate * 100).toFixed(2)}% electricity-value escalation.</p>
      </section>

      <section className="mt-6">
        <h2 className="eyebrow text-primary">Next checks that can unlock adoption</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-secondary">
          <li>Confirm roof condition, warranty coordination, attachment approach, and structural capacity with qualified professionals.</li>
          <li>Validate system size and annual production with a site-specific design or PVWatts study.</li>
          <li>Confirm utility territory, rate class, meter topology, account holders, and credit-allocation rules.</li>
          <li>Document capital responsibility, access rights, lease duration, consent, and treatment of charges and savings.</li>
          <li>Verify current incentive, tax, permitting, and interconnection eligibility independently.</li>
        </ul>
      </section>

      <footer className="mt-6 border-t border-mint-border pt-4 text-xs text-ink-secondary">
        <div className="mb-2"><LegalLabels /></div>
        <p>{result.notes.join(' ')} Engine {result.model_version}. Results are conditional on the entered sources and assumptions and do not establish structural feasibility, project approval, or eligibility.</p>
      </footer>
    </article>
  );
}
