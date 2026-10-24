'use client';

import { useEffect, useState } from 'react';
import { useScenario } from './ScenarioProvider';
import { PdfViewer } from './PdfViewer';

export function DocumentDrawer() {
  const { sourceDocument } = useScenario();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!sourceDocument) return null;

  return (
    <>
      <button
        type="button"
        className="no-print fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-on-primary shadow-lg shadow-[#0d503622]"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden>▣</span> View source PDF
      </button>
      {open && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#082d25aa] p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Uploaded source PDF"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-full w-full max-w-5xl overflow-auto rounded-xl bg-canvas p-3 shadow-2xl sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow text-primary">Source document</p>
                <p className="text-sm text-ink-secondary">Available throughout this analysis.</p>
              </div>
              <button type="button" className="pill pill-tint" onClick={() => setOpen(false)} autoFocus>
                Close
              </button>
            </div>
            <PdfViewer document={sourceDocument} />
          </div>
        </div>
      )}
    </>
  );
}
