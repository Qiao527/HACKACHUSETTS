'use client';

import { BriefLayout } from '../components/BriefLayout';
import { DemoShell, ScenarioGate } from '../components/DemoShell';
import { useScenario } from '../components/ScenarioProvider';

function BriefBody() {
  const { input, result, recalculating, projectDetails, sourceDocument } = useScenario();
  if (!input) return null;
  if (!result) return <p className="rounded-xl bg-mint-soft p-5 text-sm text-ink-secondary" role="status">{recalculating ? 'Recalculating. The project brief will appear when the current result is ready…' : 'The project brief is unavailable because no current result exists.'}</p>;
  return (
    <div>
      <div className="mb-5 flex justify-end no-print"><button type="button" className="pill pill-primary" onClick={() => window.print()}>Print / save as PDF</button></div>
      <BriefLayout input={input} result={result} projectDetails={projectDetails} sourceDocumentName={sourceDocument?.name} />
    </div>
  );
}

export default function BriefPage() {
  return (
    <DemoShell current="/brief" title="Share the project brief" intro="A source-aware summary of timing, project economics, building-user value, assumptions, and the practical questions that must be resolved to move solar forward.">
      <ScenarioGate><BriefBody /></ScenarioGate>
    </DemoShell>
  );
}
