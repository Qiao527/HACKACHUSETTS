'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DemoShell } from '../components/DemoShell';
import { PdfViewer } from '../components/PdfViewer';
import { SourceBadge, StatusBadge } from '../components/Badges';
import { useScenario } from '../components/ScenarioProvider';
import { extract } from '../lib/api';
import {
  applyExtractedField,
  buildEngineInput,
  contextDetailsFromDraft,
  draftFromScenario,
  draftKeyForExtractedField,
  emptyAnalysisDraft,
  extractedFieldValue,
  type AnalysisDraft,
  validateDraft,
} from '../lib/analysis';
import { FIELD_SCHEMA, type FieldDefinition } from '../lib/fieldDefinitions';
import { LatestRequest } from '../lib/latest-request';
import type { EngineInput, InputField } from '../lib/contract';

export default function AnalyzePage() {
  return (
    <DemoShell
      current="/analyze"
      title="Analyze a solar opportunity"
      intro="Start with what you know. Enter project information directly, or upload a selectable-text PDF to bring source-backed roof and proposal facts into the same review."
    >
      <AnalyzeWorkspace />
    </DemoShell>
  );
}

function AnalyzeWorkspace() {
  const router = useRouter();
  const {
    input,
    loading,
    projectDetails,
    extractedFields,
    sourceDocument,
    setInput,
    setProjectDetails,
    setExtractedFields,
    retireExtractedField,
    invalidateCalculation,
    attachDocument,
    removeDocument,
    clearAnalysis,
  } = useScenario();
  const initialized = useRef(false);
  const documentRequests = useRef(new LatestRequest());
  const selectedDocumentKey = useRef<string | null>(null);
  const documentDraftKeys = useRef<Set<string>>(new Set());
  const [draft, setDraft] = useState<AnalysisDraft>(emptyAnalysisDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [extractingText, setExtractingText] = useState(false);
  const [extractingFields, setExtractingFields] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || initialized.current) return;
    setDraft(draftFromScenario(input, projectDetails));
    documentDraftKeys.current = new Set(
      extractedFields
        .filter((field) => field.status === 'confirmed' && field.confirmed_by_user)
        .map((field) => {
          const key = draftKeyForExtractedField(field.field);
          if (!key) return null;
          const selected = input?.[key as keyof EngineInput];
          if (selected && typeof selected === 'object' && 'field' in selected) {
            const chosen = selected as InputField;
            const sameValue = chosen.value === field.value && chosen.value_range?.join(',') === field.value_range?.join(',');
            return sameValue && chosen.evidence?.document_id === field.evidence?.document_id ? key : null;
          }
          return projectDetails[key] === extractedFieldValue(field) ? key : null;
        })
        .filter((key): key is string => Boolean(key)),
    );
    initialized.current = true;
  }, [input, loading, projectDetails, extractedFields]);

  function update(key: string, value: string) {
    documentDraftKeys.current.delete(key);
    const linkedExtraction = extractedFields.find(
      (field) => draftKeyForExtractedField(field.field) === key && field.status === 'confirmed',
    );
    if (linkedExtraction) retireExtractedField(linkedExtraction.field);
    if (input) invalidateCalculation();
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function clearDocumentDerivedValues(): AnalysisDraft {
    const cleaned = { ...draft };
    for (const key of documentDraftKeys.current) cleaned[key] = '';
    documentDraftKeys.current.clear();
    setDraft(cleaned);
    setProjectDetails(contextDetailsFromDraft(cleaned));
    return cleaned;
  }

  async function uploadPdf(file: File) {
    const request = documentRequests.current.begin();
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    selectedDocumentKey.current = key;
    setDocumentError(null);
    setPages([]);
    setExtractingText(false);
    setExtractingFields(false);
    setSelectedFile(file);
    if (file.size > 10 * 1024 * 1024) {
      setDocumentError('Choose a PDF that is 10 MB or smaller.');
      return;
    }
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setDocumentError('Choose a PDF file.');
      return;
    }
    const cleanedDraft = clearDocumentDerivedValues();
    await attachDocument(file, contextDetailsFromDraft(cleanedDraft));
    if (!documentRequests.current.isCurrent(request) || selectedDocumentKey.current !== key) return;
    setExtractingText(true);
    try {
      const response = await extract(file, false);
      if (documentRequests.current.isCurrent(request) && selectedDocumentKey.current === key) {
        setPages(response.pages);
      }
    } catch (reason) {
      if (documentRequests.current.isCurrent(request) && selectedDocumentKey.current === key) {
        setDocumentError(reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      if (documentRequests.current.isCurrent(request) && selectedDocumentKey.current === key) {
        setExtractingText(false);
      }
    }
  }

  async function identifyFields() {
    if (!selectedFile) {
      setDocumentError('Re-upload the PDF in this tab before requesting AI-assisted field identification.');
      return;
    }
    const request = documentRequests.current.begin();
    const key = `${selectedFile.name}:${selectedFile.size}:${selectedFile.lastModified}`;
    selectedDocumentKey.current = key;
    setExtractingText(false);
    setExtractingFields(true);
    setDocumentError(null);
    try {
      const response = await extract(selectedFile, true);
      if (!documentRequests.current.isCurrent(request) || selectedDocumentKey.current !== key) return;
      setPages(response.pages);
      setExtractedFields(response.fields);
    } catch (reason) {
      if (documentRequests.current.isCurrent(request) && selectedDocumentKey.current === key) {
        setDocumentError(reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      if (documentRequests.current.isCurrent(request) && selectedDocumentKey.current === key) {
        setExtractingFields(false);
      }
    }
  }

  function acceptExtractedField(field: InputField) {
    const target = draftKeyForExtractedField(field.field);
    const candidate = extractedFieldValue(field);
    if (!target || !candidate || field.status === 'missing') return;
    const currentValue = (draft[target] ?? '').trim();
    if (currentValue && currentValue !== candidate && !window.confirm(`Replace the current ${target.replace(/_/g, ' ')} value with the cited PDF value?`)) return;
    if (input) invalidateCalculation();
    setDraft((current) => applyExtractedField(current, field));
    documentDraftKeys.current.add(target);
    setExtractedFields(
      extractedFields.map((item) => item.field === field.field
        ? { ...item, status: 'confirmed', confirmed_by_user: true }
        : item),
    );
  }

  function runAnalysis() {
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(`field-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    setProjectDetails(contextDetailsFromDraft(draft));
    setInput(buildEngineInput(draft, extractedFields));
    router.push('/timing');
  }

  if (loading) return <p className="text-ink-secondary">Preparing an empty analysis…</p>;

  return (
    <div className="space-y-10">
      <section className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
        <div className="rounded-xl bg-mint-soft p-6">
          <p className="eyebrow text-primary">Option 1 · Bring a document</p>
          <h2 className="h2 mt-2">Upload a roof report or proposal</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
            A text-based PDF can be read page by page. Basic text extraction uses our Python service and does not call AI. You can then optionally ask the configured AI provider to identify exact, cited facts.
          </p>
          <label className="mt-5 block">
            <span className="sr-only">Choose PDF</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="block w-full rounded-lg border border-mint-border bg-white p-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-white"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadPdf(file);
              }}
            />
          </label>
          <div className="mt-4 rounded-lg border border-mint-border bg-white p-4 text-xs leading-relaxed text-ink-secondary">
            <strong className="text-ink">Document privacy:</strong> text-only extraction stays within the SolarAlign API. “Identify fields with AI” sends extracted document text to the configured third-party LLM. Do not use that option for confidential material without authorization.
          </div>
          {extractingText && <p className="mt-3 text-sm text-primary" role="status">Extracting selectable text…</p>}
          {documentError && <p className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger">{documentError}</p>}
          {sourceDocument && (
            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap gap-2">
                <button type="button" className="pill pill-primary" onClick={() => void identifyFields()} disabled={extractingFields}>
                  {extractingFields ? 'Identifying source-backed fields…' : 'Identify fields with AI'}
                </button>
                <button
                  type="button"
                  className="pill pill-tint"
                  onClick={() => {
                    documentRequests.current.invalidate();
                    selectedDocumentKey.current = null;
                    setSelectedFile(null);
                    setPages([]);
                    setExtractingText(false);
                    setExtractingFields(false);
                    clearDocumentDerivedValues();
                    setExtractedFields([]);
                    void removeDocument();
                  }}
                >
                  Remove PDF
                </button>
              </div>
              <PdfViewer document={sourceDocument} />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-mint-border bg-white p-6">
          <p className="eyebrow text-primary">Option 2 · Collect it in the field</p>
          <h2 className="h2 mt-2">Use the project worksheet</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
            The six-page worksheet gives facilities, maintenance, roof, and solar teams one checklist. Every item explains what to collect, why it matters, and where to find it.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="/solaralign-field-worksheet.pdf" download className="pill pill-primary">Download PDF worksheet</a>
            <Link href="/field-form" className="pill pill-tint">Preview printable form</Link>
          </div>
          <div className="mt-6 rounded-lg bg-mint-soft p-4">
            <p className="font-medium text-ink">You can combine both paths.</p>
            <p className="mt-1 text-sm text-ink-secondary">Upload an existing report, then fill any gaps below. Extracted facts retain their page and exact quote; manual values stay visibly labeled as user supplied.</p>
          </div>
          {pages.length > 0 && (
            <details className="mt-5">
              <summary className="cursor-pointer text-sm font-medium text-primary">View extracted text from {pages.length} page{pages.length === 1 ? '' : 's'}</summary>
              <div className="mt-3 max-h-[420px] space-y-3 overflow-auto rounded-lg bg-mint-soft p-3">
                {pages.map((page, index) => (
                  <section key={index} className="rounded-lg bg-white p-3">
                    <p className="eyebrow text-ink-secondary">Page {index + 1}</p>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink-secondary">{page}</pre>
                  </section>
                ))}
              </div>
            </details>
          )}
        </div>
      </section>

      {extractedFields.length > 0 && (
        <section className="rounded-xl border border-mint-border bg-white p-6">
          <p className="eyebrow text-primary">AI-located candidates</p>
          <h2 className="h2 mt-2">Confirm meaning before using a finding</h2>
          <p className="mt-2 text-sm text-ink-secondary">Code verified that each quote appears on the cited page and that numeric fields use server-owned units. AI can still misunderstand what a sentence means, so no candidate enters the calculation or intake until you choose “Use this finding.”</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {extractedFields.map((field) => {
              const target = draftKeyForExtractedField(field.field);
              const candidate = extractedFieldValue(field);
              const accepted = field.status === 'confirmed' && field.confirmed_by_user;
              return (
                <article key={field.field} className="rounded-lg bg-mint-soft p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium capitalize text-ink">{field.field.replace(/_/g, ' ')}</p>
                    <div className="flex gap-1"><StatusBadge status={field.status} />{field.evidence && <SourceBadge source={field.evidence.source_type} />}</div>
                  </div>
                  <p className="mt-2 text-sm text-ink">{candidate || 'Missing'} {field.unit}</p>
                  {field.evidence && <blockquote className="mt-2 border-l-2 border-primary pl-3 text-xs italic text-ink-secondary">“{field.evidence.evidence_text}” — page {field.evidence.page}</blockquote>}
                  {target && candidate && field.status !== 'missing' && (
                    <button type="button" className={`pill mt-3 h-9 text-xs ${accepted ? 'pill-tint' : 'pill-primary'}`} disabled={accepted} onClick={() => acceptExtractedField(field)}>
                      {accepted ? 'Cited value added to form' : 'Use this finding'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <form
        className="space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          runAnalysis();
        }}
        noValidate
      >
        <div>
          <p className="eyebrow text-primary">Manual intake</p>
          <h2 className="h1 mt-2">Complete the project information</h2>
          <p className="mt-2 max-w-3xl text-ink-secondary">Nothing is prefilled. Required calculation fields are marked; contextual fields make the analysis easier to verify and act on.</p>
        </div>

        {FIELD_SCHEMA.sections.map((section) => (
          <section key={section.title} className="rounded-xl border border-mint-border bg-white p-5 sm:p-7">
            <h3 className="h2">{section.title}</h3>
            <p className="mt-2 max-w-3xl text-sm text-ink-secondary">{section.description}</p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {section.fields.map((field) => (
                <AnalysisField key={field.key} field={field} value={draft[field.key] ?? ''} error={errors[field.key]} onChange={update} />
              ))}
            </div>
          </section>
        ))}

        {Object.keys(errors).length > 0 && (
          <p className="rounded-lg bg-danger-soft p-4 text-sm text-danger" role="alert">
            Complete the {Object.keys(errors).length} highlighted required field{Object.keys(errors).length === 1 ? '' : 's'} before calculating.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-mint-soft p-5">
          <button type="submit" className="pill pill-primary">Calculate timing and project value →</button>
          {(input || Object.values(draft).some(Boolean) || sourceDocument) && (
            <button
              type="button"
              className="pill pill-tint"
              onClick={() => {
                if (!window.confirm('Clear this analysis and remove the retained PDF from this browser?')) return;
                documentRequests.current.invalidate();
                selectedDocumentKey.current = null;
                void clearAnalysis().then(() => {
                  initialized.current = true;
                  setDraft(emptyAnalysisDraft());
                  setSelectedFile(null);
                  setPages([]);
                  setErrors({});
                });
              }}
            >
              Clear analysis
            </button>
          )}
          <p className="text-xs text-ink-secondary">Calculations are deterministic. AI may locate evidence, but it never calculates financial results.</p>
        </div>
      </form>
    </div>
  );
}

function AnalysisField({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDefinition;
  value: string;
  error?: string;
  onChange: (key: string, value: string) => void;
}) {
  const descriptionId = `help-${field.key}`;
  const errorId = `error-${field.key}`;
  return (
    <label className="block" htmlFor={`field-${field.key}`}>
      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
        {field.label}
        {field.required_for_model && <span className="badge border-primary bg-primary-soft text-primary">required for model</span>}
        {field.required && !field.required_for_model && <span className="badge border-primary bg-primary-soft text-primary">required</span>}
        {!field.required && !field.required_for_model && <span className="badge border-mint-border text-ink-secondary">project context</span>}
      </span>
      <span className="mt-1 block text-xs text-ink-secondary">{field.unit || 'Text'}</span>
      <input
        id={`field-${field.key}`}
        type={field.input_type}
        value={value}
        min={field.min}
        max={field.max}
        step={field.step ?? (field.input_type === 'number' ? 'any' : undefined)}
        required={field.required}
        aria-invalid={Boolean(error)}
        aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ''}`}
        onChange={(event) => onChange(field.key, event.target.value)}
        className={`mt-2 h-11 w-full rounded-lg border bg-white px-3 text-ink ${error ? 'border-danger' : 'border-mint-border'}`}
      />
      <span id={descriptionId} className="mt-2 block space-y-1 text-xs leading-relaxed text-ink-secondary">
        <span className="block"><strong className="text-ink">What:</strong> {field.note}</span>
        <span className="block"><strong className="text-ink">Why:</strong> {field.importance}</span>
        <span className="block"><strong className="text-ink">Find it in:</strong> {field.source_hint}</span>
      </span>
      {error && <span id={errorId} className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}
