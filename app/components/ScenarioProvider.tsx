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

interface ScenarioState {
  input: EngineInput | null;
  result: EngineResult | null;
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
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { demo_input } = await getConstants();
      setInputState(demo_input);
      const res = await runEngine(demo_input);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Every input change re-calls the engine (fast, no LLM). The UI never does
  // the math itself (ui-rules.md).
  const setInput = useCallback((next: EngineInput) => {
    setInputState(next);
    const id = ++reqId.current;
    setRecalculating(true);
    runEngine(next)
      .then((res) => {
        if (id === reqId.current) setResult(res);
      })
      .catch((e) => {
        if (id === reqId.current) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (id === reqId.current) setRecalculating(false);
      });
  }, []);

  const value = useMemo<ScenarioState>(
    () => ({ input, result, loading, error, recalculating, setInput, reload: load }),
    [input, result, loading, error, recalculating, setInput, load],
  );

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario(): ScenarioState {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error('useScenario must be used within a ScenarioProvider');
  return ctx;
}
