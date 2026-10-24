'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getConstants, runEngine } from '../lib/api';
import type { EngineInput, EngineResult } from '../lib/contract';
import { LatestRequest } from '../lib/latest-request';

interface ScenarioState {
  input: EngineInput | null;
  /** A result is present only when it belongs to the current input revision. */
  result: EngineResult | null;
  inputRevision: number;
  loading: boolean;
  error: string | null;
  recalculating: boolean;
  setInput: (next: EngineInput) => void;
  reload: () => void;
}

const ScenarioContext = createContext<ScenarioState | null>(null);

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const [input, setInputState] = useState<EngineInput | null>(null);
  const [result, setResult] = useState<EngineResult | null>(null);
  const [inputRevision, setInputRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const requests = useRef(new LatestRequest());

  const load = useCallback(async () => {
    const request = requests.current.begin();
    revision.current += 1;
    setInputRevision(revision.current);
    setLoading(true);
    setRecalculating(false);
    setError(null);
    setInputState(null);
    setResult(null);

    try {
      const { demo_input } = await getConstants();
      if (!requests.current.isCurrent(request)) return;
      setInputState(demo_input);

      const res = await runEngine(demo_input);
      if (!requests.current.isCurrent(request)) return;
      setResult(res);
    } catch (e) {
      if (!requests.current.isCurrent(request)) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (requests.current.isCurrent(request)) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => requests.current.invalidate();
  }, [load]);

  // Every input change re-calls the engine (fast, no LLM). The previous result
  // is cleared immediately so no page can present it as belonging to new input.
  const setInput = useCallback((next: EngineInput) => {
    const request = requests.current.begin();
    revision.current += 1;
    setInputState(next);
    setInputRevision(revision.current);
    setResult(null);
    setError(null);
    setLoading(false);
    setRecalculating(true);

    runEngine(next)
      .then((res) => {
        if (requests.current.isCurrent(request)) setResult(res);
      })
      .catch((e) => {
        if (requests.current.isCurrent(request)) {
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (requests.current.isCurrent(request)) setRecalculating(false);
      });
  }, []);

  const value = useMemo<ScenarioState>(
    () => ({
      input,
      result,
      inputRevision,
      loading,
      error,
      recalculating,
      setInput,
      reload: load,
    }),
    [input, result, inputRevision, loading, error, recalculating, setInput, load],
  );

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario(): ScenarioState {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error('useScenario must be used within a ScenarioProvider');
  return ctx;
}
