'use client';

import { useState } from 'react';
import type { EngineInput, InputField } from '../lib/contract';
import { SourceBadge, StatusBadge } from './Badges';

interface Props {
  field: InputField;
  fieldKey: keyof EngineInput;
  displayValue: string;
  onConfirm: (key: keyof EngineInput) => void;
  onEdit: (key: keyof EngineInput, value: number) => void;
  editable?: boolean;
}

// A single fact with its page, quote and status. Click to expand the quote;
// confirm or edit inline (ui-rules.md: evidence panel with clickable quotes).
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

  const label = field.field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="rounded-xl border border-mint-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="eyebrow text-ink-secondary">{label}</p>
          <p className="mt-1 text-lg" style={{ fontWeight: 460 }}>
            {field.value_range
              ? `${field.value_range[0]}–${field.value_range[1]} ${field.unit}`
              : `${displayValue}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={field.status} />
          {field.evidence && <SourceBadge source={field.evidence.source_type} />}
        </div>
      </div>

      {field.evidence ? (
        <div className="mt-3">
          <button
            type="button"
            className="text-sm text-primary underline underline-offset-2"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'Hide' : 'Show'} source — page {field.evidence.page}
          </button>
          {open && (
            <blockquote
              className="mt-2 rounded-lg border-l-2 border-primary bg-mint-soft px-3 py-2 text-sm italic text-ink"
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
                onChange={(e) => setDraft(e.target.value)}
                className="h-9 w-40 rounded-lg border border-mint-border px-2 text-ink"
                aria-label={`Edit ${label}`}
              />
              <button
                type="button"
                className="pill pill-primary h-9"
                onClick={() => {
                  const v = Number(draft);
                  if (!Number.isNaN(v)) {
                    onEdit(fieldKey, v);
                    setEditing(false);
                  }
                }}
              >
                Save
              </button>
              <button type="button" className="pill pill-tint h-9" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              {field.status !== 'confirmed' && field.status !== 'human_supplied' && (
                <button
                  type="button"
                  className="pill pill-tint h-9"
                  onClick={() => onConfirm(fieldKey)}
                >
                  Confirm
                </button>
              )}
              <button
                type="button"
                className="pill pill-tint h-9"
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
