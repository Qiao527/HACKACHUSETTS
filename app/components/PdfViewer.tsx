'use client';

import type { UploadedDocument } from './ScenarioProvider';

export function PdfViewer({ document }: { document: UploadedDocument }) {
  return (
    <div className="overflow-hidden rounded-lg border border-mint-border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-mint-border bg-mint-soft px-3 py-2 text-sm">
        <div>
          <p className="font-medium text-ink">{document.name}</p>
          <p className="text-xs text-ink-secondary">
            {(document.size / 1024 / 1024).toFixed(2)} MB · {document.persisted ? 'retained in this browser across refreshes' : 'available in this tab; browser storage was unavailable'}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={document.url} target="_blank" rel="noreferrer" className="pill pill-tint h-8 text-xs">
            Open in new tab
          </a>
          <a href={document.url} download={document.name} className="pill pill-tint h-8 text-xs">
            Download original
          </a>
        </div>
      </div>
      <iframe
        title={`PDF viewer: ${document.name}`}
        src={`${document.url}#toolbar=1&navpanes=1`}
        className="h-[68vh] min-h-[440px] w-full bg-white"
      />
      <p className="border-t border-mint-border px-3 py-2 text-xs text-ink-secondary">
        If your browser cannot display the PDF inline, use “Open in new tab” or “Download original.”
      </p>
    </div>
  );
}
