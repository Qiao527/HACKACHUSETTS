'use client';

import { useId, useState } from 'react';
import type { EngineInput, InputField, SourceType } from '../lib/contract';

interface Props {
  field: InputField;
  fieldKey: keyof EngineInput;
  displayValue: string;
  onConfirm: (key: keyof EngineInput) => void;
  onEdit: (key: keyof EngineInput, value: number) => void;
  editable?: boolean;
}

const SOURCE_LABELS: Record<SourceType, string> = {
  synthetic_document: 'Demo report',
  assumption: 'Modeled assumption',
  public_record: 'Public record',
  api_fixture: 'Modeled from a cached API response',
};

function actionStatus(field: InputField): { label: string; cls: string; mark: string } | null {
  if (field.status === 'extracted_unconfirmed') {
    return { label: 'Needs confirmation', cls: 'text-warn', mark: '○' };
  }

  if (field.status === 'confirmed' && field.evidence?.source_type !== 'api_fixture') {
    return { label: 'Confirmed', cls: 'text-ok', mark: '✓' };
  }

  if (field.status === 'human_supplied') {
    return { label: 'Edited by you', cls: 'text-primary', mark: '✎' };
  }

  if (field.status === 'conflicting') {
    return { label: 'Conflict', cls: 'text-danger', mark: '≠' };
  }

  return null;
}

// A single fact with separate user-action state and source metadata. Source
// details retain the page reference and exact quote; confirm and edit stay inline.
export function ProvenanceField({
  field,
  fieldKey,
  displayValue,
  onConfirm,
  onEdit,
  editable = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.value != null ? String(field.value) : '');
  const sourceDetailsId = useId();
  const status = actionStatus(field);

  const label = field.field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="rounded-md bg-surface p-4" style={{ border: '1px solid #ededf3' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-ink-secondary">{label}</p>
          <p className="mt-1 text-lg" style={{ fontWeight: 460 }}>
            {field.value_range
              ? `${field.value_range[0]}–${field.value_range[1]} ${field.unit}`
              : displayValue}
          </p>
        </div>

        {status && (
          <span
            className={`flex min-h-6 items-center gap-1 text-xs ${status.cls}`}
            aria-live="polite"
          >
            <span aria-hidden>{status.mark}</span>
            {status.label}
          </span>
        )}
      </div>

      {field.evidence ? (
        <div className="mt-3 border-t border-[#ededf3] pt-3">
          <p className="text-xs text-ink-secondary">
            Source: {SOURCE_LABELS[field.evidence.source_type]}.{' '}
            {field.evidence.document_id}, page {field.evidence.page}.
          </p>
          <button
            type="button"
            className="mt-2 min-h-11 text-sm text-primary underline underline-offset-2"
            aria-expanded={open}
            aria-controls={sourceDetailsId}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? 'Hide' : 'Show'} source {field.evidence.source_type === 'synthetic_document' ? 'quote' : 'details'}
          </button>
          {open && (
            <blockquote
              id={sourceDetailsId}
              className="mt-1 rounded-sm bg-lavender px-3 py-2 text-sm italic text-ink"
              style={{ borderLeft: '3px solid #5266eb' }}
            >
              “{field.evidence.evidence_text}”
              <footer className="mt-1 not-italic text-xs text-ink-secondary">
                {field.evidence.document_id}, page {field.evidence.page}
              </footer>
            </blockquote>
          )}
        </div>
      ) : (
        field.status === 'missing' &&
        field.request && (
          <p className="mt-3 rounded-sm bg-[#b4324a0f] px-3 py-2 text-sm text-danger">
            Missing — {field.request}
          </p>
        )
      )}

      {editable && (
        <div className="mt-3 flex flex-wrap items-center gap-2 no-print">
          {editing ? (
            <>
              <input
                type="number"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="h-11 w-40 rounded-sm px-2 text-ink"
                style={{ border: '1px solid #c3c3cc' }}
                aria-label={`Edit ${label}`}
              />
              <button
                type="button"
                className="pill pill-primary h-11"
                onClick={() => {
                  const value = Number(draft);
                  if (!Number.isNaN(value)) {
                    onEdit(fieldKey, value);
                    setEditing(false);
                  }
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="pill pill-tint h-11"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {field.status !== 'confirmed' && field.status !== 'human_supplied' && (
                <button
                  type="button"
                  className="pill pill-tint h-11"
                  onClick={() => onConfirm(fieldKey)}
                >
                  Confirm
                </button>
              )}
              <button
                type="button"
                className="pill pill-tint h-11"
                onClick={() => {
                  setDraft(field.value != null ? String(field.value) : '');
                  setEditing(true);
                }}
              >
                Edit
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
