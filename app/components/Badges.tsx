import type { SourceType, Status } from '../lib/contract';

export function SourceBadge({ source }: { source: SourceType }) {
  const map: Record<SourceType, { label: string; cls: string; mark: string }> = {
    synthetic_document: { label: 'synthetic', cls: 'border-warn bg-[#8a620014] text-warn', mark: '◆' },
    uploaded_document: { label: 'uploaded PDF', cls: 'border-primary bg-primary-soft text-primary', mark: '▣' },
    assumption: { label: 'assumption', cls: 'border-slate bg-mint-wash text-ink-secondary', mark: '≈' },
    public_record: { label: 'public record', cls: 'border-primary bg-primary-soft text-primary', mark: '●' },
    api_fixture: { label: 'cached API', cls: 'border-mint-accent bg-mint-soft text-ink-secondary', mark: '⤓' },
  };
  const value = map[source];
  return <span className={`badge ${value.cls}`}><span aria-hidden>{value.mark}</span>{value.label}</span>;
}

export function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string; mark: string }> = {
    confirmed: { label: 'confirmed', cls: 'border-ok bg-primary-soft text-ok', mark: '✓' },
    extracted_unconfirmed: { label: 'needs review', cls: 'border-warn bg-[#8a620014] text-warn', mark: '○' },
    human_supplied: { label: 'entered by you', cls: 'border-primary bg-primary-soft text-primary', mark: '✎' },
    missing: { label: 'missing', cls: 'border-danger bg-danger-soft text-danger', mark: '!' },
    conflicting: { label: 'conflict', cls: 'border-danger bg-danger-soft text-danger', mark: '≠' },
  };
  const value = map[status];
  return <span className={`badge ${value.cls}`}><span aria-hidden>{value.mark}</span>{value.label}</span>;
}

export function LegalLabels() {
  return <div className="flex flex-wrap gap-2"><span className="badge border-slate text-ink-secondary">not legal or structural advice</span><span className="badge border-slate text-ink-secondary">eligibility not verified</span></div>;
}
