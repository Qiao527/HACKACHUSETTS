'use client';
import { useEffect, useRef, useState } from 'react';
import { coordinate } from '../lib/api';
import type { CoordinatorOutput, EngineResult, Language } from '../lib/contract';
import { SCHEDULE_LABELS } from '../lib/contract';
import { pct } from '../lib/format';
import { LatestRequest } from '../lib/latest-request';
import { ANALYZED_SCHEDULE } from '../lib/scenario';
import { LegalLabels } from './Badges';

interface Props {
  result: EngineResult;
  inputRevision: number;
}

// AI coordinator panel. It reads only the current EngineResult and copies engine
// numbers. A client-side input revision, rather than scenario_id, owns each response.
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

  async function request(lang: Language) {
    const requestToken = requests.current.begin();
    const requestedRevision = inputRevision;
    const requestedResult = result;
    setLanguage(lang);
    setOutput(null);
    setLoading(true);
    setError(null);

    try {
      const nextOutput = await coordinate(requestedResult, lang);
      if (
        requests.current.isCurrent(requestToken) &&
        currentRevision.current === requestedRevision &&
        currentResult.current === requestedResult
      ) {
        setOutput(nextOutput);
      }
    } catch (e) {
      if (
        requests.current.isCurrent(requestToken) &&
        currentRevision.current === requestedRevision &&
        currentResult.current === requestedResult
      ) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (
        requests.current.isCurrent(requestToken) &&
        currentRevision.current === requestedRevision &&
        currentResult.current === requestedResult
      ) {
        setLoading(false);
      }
    }
  }

  function selectLanguage(lang: Language) {
    if (loading || output) {
      void request(lang);
    } else {
      requests.current.invalidate();
      setLanguage(lang);
      setError(null);
    }
  }

  const t = (en: string, es: string) => (language === 'es' ? es : en);

  return (
    <section className="rounded-md bg-surface p-6" style={{ border: '1px solid #ededf3' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-ink-secondary">AI coordinator</p>
          <h3 className="h2 mt-1">{t('Proposed allocation', 'Asignación propuesta')}</h3>
          <p className="mt-2 text-sm text-ink-secondary">
            {t('Analyzed roof schedule:', 'Programa de techo analizado:')}{' '}
            <span className="text-ink">{SCHEDULE_LABELS[ANALYZED_SCHEDULE]}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 no-print" role="group" aria-label="Language">
          <button
            type="button"
            className={`pill h-9 ${language === 'en' ? 'pill-primary' : 'pill-tint'}`}
            aria-pressed={language === 'en'}
            onClick={() => selectLanguage('en')}
          >
            English
          </button>
          <button
            type="button"
            className={`pill h-9 ${language === 'es' ? 'pill-primary' : 'pill-tint'}`}
            aria-pressed={language === 'es'}
            onClick={() => selectLanguage('es')}
          >
            Español
          </button>
        </div>
      </div>

      {!output && (
        <div className="mt-4">
          <p className="text-sm text-ink-secondary">
            {result.mutual_benefit_range
              ? t(
                  'The engine found a Positive-Outcome Range where both financial metrics are above zero. Ask the coordinator to draft a share inside it. The range does not establish agreement.',
                  'El motor encontró un rango de resultado positivo donde ambas métricas financieras superan cero. Pide al coordinador que prepare una proporción dentro del rango. El rango no establece un acuerdo.',
                )
              : t(
                  'The engine found no Positive-Outcome Range. The coordinator will say so and propose nothing.',
                  'El motor no encontró un rango de resultado positivo. El coordinador lo indicará y no propondrá nada.',
                )}
          </p>
          <button
            type="button"
            className="pill pill-primary mt-4 no-print"
            onClick={() => request(language)}
            disabled={loading}
          >
            {loading ? t('Thinking…', 'Pensando…') : t('Generate proposal', 'Generar propuesta')}
          </button>
          {error && (
            <p className="mt-3 rounded-sm bg-[#b4324a0f] px-3 py-2 text-sm text-danger">
              {t('Coordinator unavailable', 'Coordinador no disponible')}: {error}
              <br />
              <span className="text-ink-secondary">
                {t(
                  'Set LLM_PROVIDER and LLM_API_KEY to enable live explanations. The financial results are complete without it.',
                  'Configura LLM_PROVIDER y LLM_API_KEY para habilitar explicaciones en vivo. Los resultados financieros están completos sin ello.',
                )}
              </span>
            </p>
          )}
        </div>
      )}

      {output && (
        <div className="mt-4 space-y-4">
          <span className="badge border-warn bg-[#9a6a0014] text-warn">
            Draft — Not Mutually Accepted
          </span>
          {output.proposed_range && (
            <p className="rounded-sm bg-lavender px-3 py-2 text-sm">
              {t('Proposed tenant share:', 'Proporción propuesta para inquilinos:')}{' '}
              <strong>
                {pct(output.proposed_range[0])}–{pct(output.proposed_range[1])}
              </strong>
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md bg-lavender p-4">
              <p className="eyebrow text-ink-secondary">{t('For the owner', 'Para el propietario')}</p>
              <p className="mt-2 text-sm leading-relaxed">{output.owner_explanation}</p>
            </div>
            <div className="rounded-md bg-lavender p-4">
              <p className="eyebrow text-ink-secondary">{t('For tenants', 'Para los inquilinos')}</p>
              <p className="mt-2 text-sm leading-relaxed">{output.tenant_explanation}</p>
            </div>
          </div>
          <div>
            <p className="eyebrow text-ink-secondary">{t('Terms to confirm', 'Términos a confirmar')}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-secondary">
              {output.terms_to_confirm.map((term, index) => (
                <li key={index}>{term}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-5 border-t pt-4" style={{ borderColor: '#ededf3' }}>
        <LegalLabels />
      </div>
    </section>
  );
}
