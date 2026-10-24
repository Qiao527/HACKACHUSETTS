'use client';

import Link from 'next/link';
import { DemoShell, ScenarioGate } from '../components/DemoShell';
import { ProvenanceField } from '../components/ProvenanceField';
import { SourceBadge, StatusBadge } from '../components/Badges';
import { useScenario } from '../components/ScenarioProvider';
import type { EngineInput, InputField } from '../lib/contract';
import { confirmField, money, withFieldValue } from '../lib/format';
import { FIELD_BY_KEY } from '../lib/fieldDefinitions';

const FIELDS: { key: keyof EngineInput; display: (input: EngineInput) => string }[] = [
  { key: 'roof_replacement_year', display: (input) => `${input.roof_replacement_year.value} years from today` },
  { key: 'roof_replacement_cost', display: (input) => money(input.roof_replacement_cost.value) },
  { key: 'removal_reinstall_cost', display: (input) => money(input.removal_reinstall_cost.value) },
  { key: 'annual_kwh', display: (input) => `${Math.round(input.annual_kwh.value ?? 0).toLocaleString('en-US')} kWh/yr` },
  { key: 'electricity_value_per_kwh', display: (input) => `$${input.electricity_value_per_kwh.value?.toFixed(4)}/kWh` },
  { key: 'solar_capex', display: (input) => money(input.solar_capex.value) },
  { key: 'om_cost_per_year', display: (input) => `${money(input.om_cost_per_year.value)}/yr` },
];

function EvidenceBody() {
  const { input, projectDetails, extractedFields, sourceDocument, setInput, retireExtractedField } = useScenario();
  if (!input) return null;
  const supplemental = extractedFields.filter((field) => !FIELDS.some(({ key }) => key === field.field));
  const contextEntries = Object.entries(projectDetails).filter(([key, value]) => key !== 'project_name' && value.trim());

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl bg-mint-soft p-4">
        <span className="font-medium text-ink">{input.scenario_id}</span>
        {sourceDocument ? <span className="badge border-primary bg-primary-soft text-primary">▣ Source PDF retained: {sourceDocument.name}</span> : <span className="badge border-mint-border text-ink-secondary">Manual intake only</span>}
        <Link href="/analyze" className="ml-auto text-sm font-medium text-primary">Edit full intake →</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {FIELDS.map(({ key, display }) => (
          <ProvenanceField
            key={String(key)}
            fieldKey={key}
            field={input[key] as InputField}
            displayValue={display(input)}
            onConfirm={(fieldKey) => setInput(confirmField(input, fieldKey))}
            onEdit={(fieldKey, value) => {
              retireExtractedField(String(fieldKey));
              setInput(withFieldValue(input, fieldKey, value));
            }}
          />
        ))}
      </div>

      {contextEntries.length > 0 && (
        <section className="mt-8">
          <h2 className="h2">Project readiness context</h2>
          <p className="mt-2 text-sm text-ink-secondary">These intake details help the team verify feasibility and implementation even when they are not direct financial-model inputs.</p>
          <dl className="mt-4 grid gap-3 md:grid-cols-2">
            {contextEntries.map(([key, value]) => (
              <div key={key} className="rounded-xl border border-mint-border bg-white p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-secondary">{FIELD_BY_KEY.get(key)?.label ?? key.replace(/_/g, ' ')}</dt>
                <dd className="mt-1 text-sm text-ink">{value}{FIELD_BY_KEY.get(key)?.unit ? ` ${FIELD_BY_KEY.get(key)?.unit}` : ''}</dd>
                <span className="badge mt-2 border-primary bg-primary-soft text-primary">entered in project intake</span>
              </div>
            ))}
          </dl>
        </section>
      )}

      {supplemental.length > 0 && (
        <section className="mt-8">
          <h2 className="h2">Additional facts from the source document</h2>
          <p className="mt-2 text-sm text-ink-secondary">These facts support project review but do not directly change the current financial engine.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {supplemental.map((field) => (
              <article key={field.field} className="rounded-xl border border-mint-border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium capitalize text-ink">{field.field.replace(/_/g, ' ')}</p><div className="flex gap-1"><StatusBadge status={field.status} />{field.evidence && <SourceBadge source={field.evidence.source_type} />}</div></div>
                <p className="mt-2 text-sm">{field.value_range ? `${field.value_range[0]}–${field.value_range[1]}` : field.value ?? field.text_value ?? 'Missing'} {field.unit}</p>
                {field.evidence && <blockquote className="mt-2 border-l-2 border-primary pl-3 text-xs italic text-ink-secondary">“{field.evidence.evidence_text}” — page {field.evidence.page}</blockquote>}
              </article>
            ))}
          </div>
        </section>
      )}

      <p className="mt-7 text-sm leading-relaxed text-ink-secondary">A source-backed fact includes the PDF name, page, and exact quote. A manual value remains labeled as user supplied. Neither one becomes a structural approval, utility eligibility finding, or guaranteed cost simply by appearing here.</p>
      <div className="mt-6 no-print"><Link href="/timing" className="pill pill-primary">Next: compare roof and solar timing →</Link></div>
    </div>
  );
}

export default function EvidencePage() {
  return (
    <DemoShell current="/evidence" title="Review sources and assumptions" intro="See what came from a document, what was entered manually, and which facts still need confirmation before the project advances.">
      <ScenarioGate><EvidenceBody /></ScenarioGate>
    </DemoShell>
  );
}
