'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { runEngine } from '../lib/api';
import type { EngineInput, EngineResult, InputField } from '../lib/contract';
import { LatestRequest } from '../lib/latest-request';

const STORAGE_KEY = 'solaralign.analysis.v4';
const PDF_DB = 'solaralign-documents';
const PDF_STORE = 'documents';

export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  persisted: boolean;
}

interface StoredPdf {
  id: string;
  name: string;
  size: number;
  type: string;
  blob: Blob;
}

interface PersistedState {
  version: 4;
  documentId: string | null;
  input: EngineInput | null;
  projectDetails: Record<string, string>;
  extractedFields: InputField[];
}

interface ScenarioState {
  input: EngineInput | null;
  result: EngineResult | null;
  inputRevision: number;
  loading: boolean;
  error: string | null;
  recalculating: boolean;
  projectDetails: Record<string, string>;
  extractedFields: InputField[];
  sourceDocument: UploadedDocument | null;
  setInput: (next: EngineInput) => void;
  setProjectDetails: (next: Record<string, string>) => void;
  setExtractedFields: (next: InputField[]) => void;
  retireExtractedField: (fieldName: string) => void;
  invalidateCalculation: () => void;
  attachDocument: (file: File, linkedProjectDetails?: Record<string, string>) => Promise<void>;
  removeDocument: () => Promise<void>;
  clearAnalysis: () => Promise<void>;
}

const ScenarioContext = createContext<ScenarioState | null>(null);

function openPdfDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PDF_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PDF_STORE)) request.result.createObjectStore(PDF_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePdf(value: StoredPdf): Promise<void> {
  const db = await openPdfDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PDF_STORE, 'readwrite');
    tx.objectStore(PDF_STORE).put(value, value.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadPdf(id: string): Promise<StoredPdf | null> {
  const db = await openPdfDb();
  const value = await new Promise<StoredPdf | null>((resolve, reject) => {
    const request = db.transaction(PDF_STORE, 'readonly').objectStore(PDF_STORE).get(id);
    request.onsuccess = () => resolve((request.result as StoredPdf | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}

async function deletePdf(id: string): Promise<void> {
  const db = await openPdfDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PDF_STORE, 'readwrite');
    tx.objectStore(PDF_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function clearPdfs(): Promise<void> {
  const db = await openPdfDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PDF_STORE, 'readwrite');
    tx.objectStore(PDF_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function newDocumentId(file: File): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
}

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const [input, setInputState] = useState<EngineInput | null>(null);
  const [result, setResult] = useState<EngineResult | null>(null);
  const [inputRevision, setInputRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectDetails, setProjectDetails] = useState<Record<string, string>>({});
  const [extractedFields, setExtractedFields] = useState<InputField[]>([]);
  const [sourceDocument, setSourceDocument] = useState<UploadedDocument | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const revision = useRef(0);
  const requests = useRef(new LatestRequest());
  const objectUrl = useRef<string | null>(null);
  const currentDocumentId = useRef<string | null>(null);

  const invalidateCalculation = useCallback(() => {
    requests.current.invalidate();
    revision.current += 1;
    setInputRevision(revision.current);
    setInputState(null);
    setResult(null);
    setError(null);
    setRecalculating(false);
  }, []);

  const calculate = useCallback((next: EngineInput) => {
    const request = requests.current.begin();
    revision.current += 1;
    setInputState(next);
    setInputRevision(revision.current);
    setResult(null);
    setError(null);
    setLoading(false);
    setRecalculating(true);
    runEngine(next)
      .then((response) => {
        if (requests.current.isCurrent(request)) setResult(response);
      })
      .catch((reason) => {
        if (requests.current.isCurrent(request)) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (requests.current.isCurrent(request)) setRecalculating(false);
      });
  }, []);

  // Restore calculation and PDF only when both carry the same document identity.
  // A failed or partial write cannot pair new facts with an older document.
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      let stored: PersistedState | null = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as PersistedState;
          if (parsed.version === 4) stored = parsed;
        }
      } catch {
        stored = null;
      }

      let storedPdf: StoredPdf | null = null;
      if (stored?.documentId) {
        try {
          storedPdf = await loadPdf(stored.documentId);
        } catch {
          storedPdf = null;
        }
      }
      if (cancelled) return;

      const documentsMatch = !stored?.documentId || storedPdf?.id === stored.documentId;
      const restoredInput = documentsMatch ? stored?.input ?? null : null;
      setProjectDetails(documentsMatch ? stored?.projectDetails ?? {} : {});
      setExtractedFields(documentsMatch ? stored?.extractedFields ?? [] : []);

      if (stored?.documentId && storedPdf?.id === stored.documentId) {
        const url = URL.createObjectURL(storedPdf.blob);
        objectUrl.current = url;
        currentDocumentId.current = storedPdf.id;
        setDocumentId(storedPdf.id);
        setSourceDocument({ ...storedPdf, url, persisted: true });
      }

      setLoading(false);
      setHydrated(true);
      if (restoredInput) calculate(restoredInput);
    }
    void hydrate();
    return () => {
      cancelled = true;
      requests.current.invalidate();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, [calculate]);

  useEffect(() => {
    if (!hydrated) return;
    const stored: PersistedState = { version: 4, documentId, input, projectDetails, extractedFields };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // In-memory analysis still works when browser persistence is unavailable.
    }
  }, [hydrated, documentId, input, projectDetails, extractedFields]);

  const attachDocument = useCallback(async (
    file: File,
    linkedProjectDetails: Record<string, string> = projectDetails,
  ) => {
    invalidateCalculation();
    setExtractedFields([]);
    const previousId = currentDocumentId.current;
    const id = newDocumentId(file);
    currentDocumentId.current = id;
    setDocumentId(id);
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const url = URL.createObjectURL(file);
    objectUrl.current = url;
    setSourceDocument({ id, name: file.name, size: file.size, type: file.type, url, persisted: false });
    if (previousId && previousId !== id) {
      try {
        await deletePdf(previousId);
      } catch {
        // A replaced document can remain orphaned only until Clear analysis.
      }
    }
    try {
      await savePdf({ id, name: file.name, size: file.size, type: file.type, blob: file });
      if (currentDocumentId.current !== id) {
        await deletePdf(id);
        return;
      }
      let currentStateAlreadyLinked = false;
      try {
        const existing = localStorage.getItem(STORAGE_KEY);
        if (existing) {
          const parsed = JSON.parse(existing) as PersistedState;
          currentStateAlreadyLinked = parsed.version === 4 && parsed.documentId === id;
        }
      } catch {
        currentStateAlreadyLinked = false;
      }
      if (!currentStateAlreadyLinked) {
        const linkedState: PersistedState = {
          version: 4,
          documentId: id,
          input: null,
          projectDetails: linkedProjectDetails,
          extractedFields: [],
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(linkedState));
      }
      if (currentDocumentId.current === id) {
        setSourceDocument((current) => current?.id === id ? { ...current, persisted: true } : current);
      }
    } catch {
      // `persisted: false` is shown in the PDF viewer; this tab remains usable.
    }
  }, [invalidateCalculation, projectDetails]);

  const removeDocument = useCallback(async () => {
    invalidateCalculation();
    setExtractedFields([]);
    const removedId = currentDocumentId.current;
    currentDocumentId.current = null;
    setDocumentId(null);
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setSourceDocument(null);
    if (removedId) {
      try {
        await deletePdf(removedId);
      } catch {
        // It is already removed from the active session.
      }
    }
  }, [invalidateCalculation]);

  const clearAnalysis = useCallback(async () => {
    invalidateCalculation();
    setProjectDetails({});
    setExtractedFields([]);
    currentDocumentId.current = null;
    setDocumentId(null);
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setSourceDocument(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      await clearPdfs();
    } catch {
      // Active memory state has still been cleared.
    }
  }, [invalidateCalculation]);

  const retireExtractedField = useCallback((fieldName: string) => {
    setExtractedFields((current) => current.map((field) => field.field === fieldName
      ? { ...field, status: 'extracted_unconfirmed', confirmed_by_user: false }
      : field));
  }, []);

  const value = useMemo<ScenarioState>(() => ({
    input,
    result,
    inputRevision,
    loading,
    error,
    recalculating,
    projectDetails,
    extractedFields,
    sourceDocument,
    setInput: calculate,
    setProjectDetails,
    setExtractedFields,
    retireExtractedField,
    invalidateCalculation,
    attachDocument,
    removeDocument,
    clearAnalysis,
  }), [
    input,
    result,
    inputRevision,
    loading,
    error,
    recalculating,
    projectDetails,
    extractedFields,
    sourceDocument,
    calculate,
    retireExtractedField,
    invalidateCalculation,
    attachDocument,
    removeDocument,
    clearAnalysis,
  ]);

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario(): ScenarioState {
  const context = useContext(ScenarioContext);
  if (!context) throw new Error('useScenario must be used within a ScenarioProvider');
  return context;
}
