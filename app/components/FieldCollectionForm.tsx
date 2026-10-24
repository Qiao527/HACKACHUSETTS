import { FIELD_SCHEMA } from '../lib/fieldDefinitions';

export function FieldCollectionForm() {
  return (
    <article className="field-form mx-auto max-w-[900px] rounded-xl border border-mint-border bg-white p-6 sm:p-9">
      <header className="border-b border-mint-border pb-5">
        <p className="eyebrow text-primary">SolarAlign</p>
        <h1 className="h1 mt-2">{FIELD_SCHEMA.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{FIELD_SCHEMA.subtitle}</p>
        <p className="mt-3 rounded-lg bg-mint-soft p-3 text-xs leading-relaxed text-ink-secondary">{FIELD_SCHEMA.instructions}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <BlankLine label="Project / building" />
          <BlankLine label="Address" />
          <BlankLine label="Collector" />
          <BlankLine label="Date" />
        </div>
      </header>

      {FIELD_SCHEMA.sections.map((section) => (
        <section key={section.title} className="field-section mt-8">
          <h2 className="h2 text-primary">{section.title}</h2>
          <p className="mt-2 text-sm text-ink-secondary">{section.description}</p>
          <div className="mt-5 space-y-5">
            {section.fields.map((field) => (
              <div key={field.key} className="field-row break-inside-avoid rounded-lg border border-mint-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-ink">{field.label}</h3>
                    {field.unit && <p className="text-xs text-ink-secondary">Unit: {field.unit}</p>}
                  </div>
                  <span className={`badge ${field.required_for_model ? 'border-primary bg-primary-soft text-primary' : 'border-mint-border text-ink-secondary'}`}>
                    {field.required_for_model ? 'required for model' : 'project context'}
                  </span>
                </div>
                <dl className="mt-3 space-y-1 text-xs leading-relaxed text-ink-secondary">
                  <div><dt className="inline font-medium text-ink">What to collect: </dt><dd className="inline">{field.note}</dd></div>
                  <div><dt className="inline font-medium text-ink">Why it matters: </dt><dd className="inline">{field.importance}</dd></div>
                  <div><dt className="inline font-medium text-ink">Suggested source: </dt><dd className="inline">{field.source_hint}</dd></div>
                </dl>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <BlankLine label="Value / observation" />
                  <BlankLine label="Source, page, or person" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <footer className="mt-8 border-t border-mint-border pt-4 text-xs leading-relaxed text-ink-secondary">
        Label estimates as estimates. Financial results do not establish structural feasibility, utility eligibility, incentive eligibility, consent, or legal terms.
      </footer>
    </article>
  );
}

function BlankLine({ label }: { label: string }) {
  return (
    <div>
      <span className="text-xs text-ink-secondary">{label}</span>
      <div className="mt-3 border-b border-ink-secondary" aria-hidden />
    </div>
  );
}
