'use client';

import { useState } from 'react';
import { coordinate } from '../lib/api';
import type { CoordinatorOutput, EngineResult, Language } from '../lib/contract';
import { pct } from '../lib/format';
import { LegalLabels } from './Badges';

// AI coordinator panel. It reads only the EngineResult and copies engine
// numbers; the backend rejects any invented number. Refreshes only when the
// user asks (ui-rules.md). en/es toggle switches explanations, not numbers.
export function ProposalPanel({ result }: { result: EngineResult }) {
  const [language, setLanguage] = useState<Language>('en');
  const [output, setOutput] = useState<CoordinatorOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(lang: Language) {
    setLoading(true);
    setError(null);
    try {
      const out = await coordinate(result, lang);
      setOutput(out);
      setLanguage(lang);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const t = (en: string, es: string) => (language === 'es' ? es : en);

  return (
    <section className="rounded-md bg-surface p-6" style={{ border: '1px solid #ededf3' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-ink-secondary">AI coordinator</p>
          <h3 className="h2 mt-1">{t('Proposed allocation', 'Asignación propuesta')}</h3>
        </div>
        <div className="flex items-center gap-2 no-print" role="group" aria-label="Language">
          <button
            type="button"
            className={`pill h-9 ${language === 'en' ? 'pill-primary' : 'pill-tint'}`}
            aria-pressed={language === 'en'}
            onClick={() => (output ? request('en') : setLanguage('en'))}
          >
            English
          </button>
          <button
            type="button"
            className={`pill h-9 ${language === 'es' ? 'pill-primary' : 'pill-tint'}`}
            aria-pressed={language === 'es'}
            onClick={() => (output ? request('es') : setLanguage('es'))}
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
                  'The engine found a mutual-benefit zone. Ask the coordinator to propose a share inside it and explain it to both sides.',
                  'El motor encontró una zona de beneficio mutuo. Pide al coordinador que proponga una proporción dentro de ella y la explique a ambas partes.',
                )
              : t(
                  'The engine found no mutual-benefit zone. The coordinator will say so and propose nothing.',
                  'El motor no encontró una zona de beneficio mutuo. El coordinador lo dirá y no propondrá nada.',
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
                  'Set LLM_PROVIDER and LLM_API_KEY to enable live explanations. The numbers above are already complete without it.',
                  'Configura LLM_PROVIDER y LLM_API_KEY para habilitar explicaciones en vivo. Los números anteriores ya están completos sin ello.',
                )}
              </span>
            </p>
          )}
        </div>
      )}

      {output && (
        <div className="mt-4 space-y-4">
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
              {output.terms_to_confirm.map((term, i) => (
                <li key={i}>{term}</li>
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
