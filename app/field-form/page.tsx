'use client';

import Link from 'next/link';
import { FieldCollectionForm } from '../components/FieldCollectionForm';

export default function FieldFormPage() {
  return (
    <div className="mx-auto max-w-content px-4 py-10 sm:px-8">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-primary">Field-ready worksheet</p>
          <p className="mt-1 text-sm text-ink-secondary">Print this page or download the generated six-page PDF.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/solaralign-field-worksheet.pdf" download className="pill pill-primary">Download PDF</a>
          <button type="button" className="pill pill-tint" onClick={() => window.print()}>Print this page</button>
          <Link href="/analyze" className="pill pill-tint">Return to Analyze</Link>
        </div>
      </div>
      <FieldCollectionForm />
    </div>
  );
}
