'use client';

import { DemoShell, ScenarioGate } from '../components/DemoShell';
import { ProvenanceField } from '../components/ProvenanceField';
import { useScenario } from '../components/ScenarioProvider';
import type { EngineInput } from '../lib/contract';
import { confirmField, money, withFieldValue } from '../lib/format';

const FIELDS: { key: keyof EngineInput; display: (i: EngineInput) => string }[] = [
  { key: 'roof_replacement_year', display: (i) => `${i.roof_replacement_year.value} years from today` },
  { key: 'roof_replacement_cost', display: (i) => money(i.roof_replacement_cost.value) },
  { key: 'removal_reinstall_cost', display: (i) => money(i.removal_reinstall_cost.value) },
  { key: 'annual_kwh', display: (i) => `${Math.round(i.annual_kwh.value ?? 0).toLocaleString('en-US')} kWh/yr` },
  { key: 'electricity_value_per_kwh', display: (i) => `$${i.electricity_value_per_kwh.value?.toFixed(2)}/kWh` },
  { key: 'solar_capex', display: (i) => money(i.solar_capex.value) },
  { key: 'om_cost_per_year', display: (i) => `${money(i.om_cost_per_year.value)}/yr` },
];

function EvidenceBody() {
  const { input, setInput } = useScenario();
  if (!input) return null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="badge border-warn text-warn bg-[#9a6a0014]">
          ◆ Sample diligence document (synthetic): demo_pca.pdf
        </span>
        <span className="badge border-warn text-warn bg-[#9a6a0014]">
          ◆ Harbor Loom Warehouse is a fictional building
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {FIELDS.map(({ key, display }) => (
          <ProvenanceField
            key={String(key)}
            fieldKey={key}
            field={input[key] as EngineInput['roof_replacement_cost']}
            displayValue={display(input)}
            onConfirm={(k) => setInput(confirmField(input, k))}
            onEdit={(k, v) => setInput(withFieldValue(input, k, v))}
          />
        ))}
      </div>
      <p className="mt-6 text-sm text-ink-secondary">
        Each fact carries a page number and an exact quote. The AI extracts; the
        code validates that the quote truly appears on the cited page. A field with
        no valid citation becomes “missing,” never a guess. Roof age is never
        inferred from the building’s construction year.
      </p>
      <div className="mt-6 no-print">
        <a href="/timing" className="pill pill-primary">
          Next: compare timing →
        </a>
      </div>
    </div>
  );
}

export default function EvidencePage() {
  return (
    <DemoShell
      current="/evidence"
      title="Review the evidence"
      intro="Facts extracted from a synthetic roof report, each traced to a page and a quote. Confirm what’s right, fix what isn’t."
    >
      <ScenarioGate>
        <EvidenceBody />
      </ScenarioGate>
    </DemoShell>
  );
}
