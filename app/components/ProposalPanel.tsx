'use client';

import { useEffect, useRef, useState } from 'react';
import { coordinate } from '../lib/api';
import type { CoordinatorOutput, EngineResult, Language } from '../lib/contract';
import { pct } from '../lib/format';
import { LatestRequest } from '../lib/latest-request';
import { LegalLabels } from './Badges';

interface Props { result: EngineResult; inputRevision: number; }

// The optional coordinator only translates a current EngineResult. Revision
// checks prevent an explanation from surviving a changed financial scenario.
export function ProposalPanel({ result, inputRevision }: Props) {
  const [language, setLanguage] = useState<Language>('en');
  const [output, setOutput] = useState<CoordinatorOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requests = useRef(new LatestRequest());
  const currentRevision = useRef(inputRevision);
  const currentResult = useRef(result);
  currentRevision.current = inputRevision;
  currentResult.current = result;

  useEffect(() => {
    requests.current.invalidate();
    setOutput(null);
    setError(null);
    setLoading(false);
    return () => requests.current.invalidate();
  }, [inputRevision, result]);

  async function request(languageChoice: Language) {
    const token = requests.current.begin();
    const requestedRevision = inputRevision;
    const requestedResult = result;
    setLanguage(languageChoice);
    setOutput(null);
    setLoading(true);
    setError(null);
    try {
      const response = await coordinate(requestedResult, languageChoice);
      if (requests.current.isCurrent(token) && currentRevision.current === requestedRevision && currentResult.current === requestedResult) setOutput(response);
    } catch (reason) {
      if (requests.current.isCurrent(token) && currentRevision.current === requestedRevision && currentResult.current === requestedResult) setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (requests.current.isCurrent(token) && currentRevision.current === requestedRevision && currentResult.current === requestedResult) setLoading(false);
    }
  }

  function selectLanguage(next: Language) {
    if (loading || output) void request(next);
    else {
      requests.current.invalidate();
      setLanguage(next);
      setError(null);
    }
  }

  const t = (english: string, spanish: string) => language === 'es' ? spanish : english;

  return (
    <section className="rounded-xl border border-mint-border bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="eyebrow text-primary">Optional AI project translator</p><h3 className="h2 mt-1">{t('Draft a next-step explanation', 'Preparar una explicación de los próximos pasos')}</h3></div>
        <div className="no-print flex items-center gap-2" role="group" aria-label="Language">
          <button type="button" className={`pill h-9 ${language === 'en' ? 'pill-primary' : 'pill-tint'}`} aria-pressed={language === 'en'} onClick={() => selectLanguage('en')}>English</button>
          <button type="button" className={`pill h-9 ${language === 'es' ? 'pill-primary' : 'pill-tint'}`} aria-pressed={language === 'es'} onClick={() => selectLanguage('es')}>Español</button>
        </div>
      </div>

      {!output && (
        <div className="mt-4">
          <p className="text-sm leading-relaxed text-ink-secondary">
            {result.mutual_benefit_range
              ? t('The engine found a planning range where both modeled outcomes exceed zero. The coordinator can explain that result to project sponsors and building users without calculating or inventing new numbers.', 'El motor encontró un rango de planificación donde ambos resultados modelados superan cero. El coordinador puede explicarlo a patrocinadores y usuarios del edificio sin calcular ni inventar cifras nuevas.')
              : t('The engine found no Positive-Outcome Range for this pathway. The coordinator can explain the constraints and the information to revisit; it will not invent a proposal.', 'El motor no encontró un rango de resultado positivo para esta vía. El coordinador puede explicar las limitaciones y la información que debe revisarse; no inventará una propuesta.')}
          </p>
          <button type="button" className="pill pill-primary mt-4 no-print" onClick={() => void request(language)} disabled={loading}>{loading ? t('Drafting…', 'Preparando…') : t('Generate explanation', 'Generar explicación')}</button>
          {error && <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{t('Coordinator unavailable', 'Coordinador no disponible')}: {error}<br /><span className="text-ink-secondary">{t('Set LLM_PROVIDER and LLM_API_KEY to enable optional explanations. The deterministic project results are complete without it.', 'Configura LLM_PROVIDER y LLM_API_KEY para habilitar explicaciones opcionales. Los resultados determinísticos están completos sin ello.')}</span></p>}
        </div>
      )}

      {output && (
        <div className="mt-4 space-y-4">
          <span className="badge border-warn bg-[#8a620014] text-warn">Draft — project-team review required</span>
          {output.proposed_range && <p className="rounded-lg bg-mint-soft px-3 py-2 text-sm">{t('Suggested planning range for building-user value share:', 'Rango de planificación sugerido para la proporción de valor de los usuarios:')} <strong>{pct(output.proposed_range[0])}–{pct(output.proposed_range[1])}</strong></p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-mint-soft p-4"><p className="eyebrow text-ink-secondary">{t('For project sponsors and implementers', 'Para patrocinadores e implementadores')}</p><p className="mt-2 text-sm leading-relaxed">{output.owner_explanation}</p></div>
            <div className="rounded-xl bg-mint-soft p-4"><p className="eyebrow text-ink-secondary">{t('For building electricity users', 'Para usuarios de electricidad del edificio')}</p><p className="mt-2 text-sm leading-relaxed">{output.tenant_explanation}</p></div>
          </div>
          <div><p className="eyebrow text-ink-secondary">{t('Items to verify before moving forward', 'Puntos por verificar antes de avanzar')}</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-secondary">{output.terms_to_confirm.map((term, index) => <li key={index}>{term}</li>)}</ul></div>
        </div>
      )}
      <div className="mt-5 border-t border-mint-border pt-4"><LegalLabels /></div>
    </section>
  );
}
