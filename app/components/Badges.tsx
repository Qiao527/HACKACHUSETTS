import type { SourceType, Status } from '../lib/contract';

// Status/label badges always pair colour with text and an icon/shape so colour
// is never the only signal (accessibility, ui-rules.md).

export function SourceBadge({ source }: { source: SourceType }) {
  const map: Record<SourceType, { label: string; cls: string; mark: string }> = {
    synthetic_document: {
      label: 'synthetic',
      cls: 'border-warn text-warn bg-[#9a6a0014]',
      mark: '◆',
    },
    assumption: {
      label: 'assumption',
      cls: 'border-slate text-ink-secondary bg-[#70707314]',
      mark: '≈',
    },
    public_record: {
      label: 'public record',
      cls: 'border-primary text-primary bg-[#5266eb14]',
      mark: '●',
    },
    api_fixture: {
      label: 'cached API',
      cls: 'border-periwinkle text-ink-secondary bg-[#9cb4e824]',
      mark: '⤓',
    },
  };
  const m = map[source];
  return (
    <span className={`badge ${m.cls}`}>
      <span aria-hidden>{m.mark}</span>
      {m.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string; mark: string }> = {
    confirmed: { label: 'confirmed', cls: 'border-ok text-ok bg-[#2f8f5b14]', mark: '✓' },
    extracted_unconfirmed: {
      label: 'needs review',
      cls: 'border-warn text-warn bg-[#9a6a0014]',
      mark: '○',
    },
    human_supplied: {
      label: 'edited by you',
      cls: 'border-primary text-primary bg-[#5266eb14]',
      mark: '✎',
    },
    missing: { label: 'missing', cls: 'border-danger text-danger bg-[#b4324a14]', mark: '!' },
    conflicting: {
      label: 'conflict',
      cls: 'border-danger text-danger bg-[#b4324a14]',
      mark: '≠',
    },
  };
  const m = map[status];
  return (
    <span className={`badge ${m.cls}`}>
      <span aria-hidden>{m.mark}</span>
      {m.label}
    </span>
  );
}

export function LegalLabels() {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="badge border-slate text-ink-secondary">not legal advice</span>
      <span className="badge border-slate text-ink-secondary">eligibility not verified</span>
    </div>
  );
}
