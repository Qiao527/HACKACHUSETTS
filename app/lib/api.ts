// Thin client for the FastAPI backend. The UI calls these and displays the
// result; it never recomputes money (ui-rules.md).
import type {
  CoordinatorOutput,
  EngineInput,
  EngineResult,
  InputField,
  Language,
} from './contract';

export interface ConstantsResponse {
  policy_constants: Record<string, unknown>;
  demo_input: EngineInput;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      /* keep statusText */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export async function getConstants(opts?: {
  tenantShare?: number;
  roofYear?: number;
}): Promise<ConstantsResponse> {
  const params = new URLSearchParams();
  if (opts?.tenantShare != null) params.set('tenant_share', String(opts.tenantShare));
  if (opts?.roofYear != null) params.set('roof_replacement_year', String(opts.roofYear));
  const qs = params.toString();
  const res = await fetch(`/api/constants${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
  return jsonOrThrow<ConstantsResponse>(res);
}

export async function runEngine(input: EngineInput): Promise<EngineResult> {
  const res = await fetch('/api/engine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return jsonOrThrow<EngineResult>(res);
}

export interface SweepPoint {
  tenant_share: number;
  owner_npv: number;
  tenant_first_full_year_savings: number;
}

export interface SweepResponse {
  scenario_id: string;
  schedule: string;
  mutual_benefit_range: [number, number] | null;
  points: SweepPoint[];
}

export async function runSweep(
  input: EngineInput,
  schedule = 'solar_now_remove_later',
  steps = 41,
): Promise<SweepResponse> {
  const params = new URLSearchParams({ schedule, steps: String(steps) });
  const res = await fetch(`/api/engine/sweep?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return jsonOrThrow<SweepResponse>(res);
}

export async function coordinate(
  result: EngineResult,
  language: Language,
): Promise<CoordinatorOutput> {
  const res = await fetch('/api/coordinate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result, language }),
  });
  return jsonOrThrow<CoordinatorOutput>(res);
}

export interface ExtractResponse {
  document_id: string;
  page_count: number;
  pages: string[];
  fields: InputField[];
  structured: boolean;
}

export async function extract(file: File, structured = false): Promise<ExtractResponse> {
  const form = new FormData();
  form.append('file', file);
  const params = new URLSearchParams({ structured: String(structured) });
  const res = await fetch(`/api/extract?${params.toString()}`, { method: 'POST', body: form });
  return jsonOrThrow<ExtractResponse>(res);
}
