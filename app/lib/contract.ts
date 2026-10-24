// TypeScript mirror of src/contract.py. Kept identical to the Pydantic models.
// The UI never computes money; these types only describe what the API returns.

export type Status =
  | 'extracted_unconfirmed'
  | 'confirmed'
  | 'missing'
  | 'conflicting'
  | 'human_supplied';

export type SourceType =
  | 'synthetic_document'
  | 'public_record'
  | 'assumption'
  | 'api_fixture';

export type Schedule =
  | 'solar_now_remove_later'
  | 'roof_and_solar_now'
  | 'roof_then_solar';

export type Language = 'en' | 'es' | 'zh';

export interface Evidence {
  document_id: string;
  page: number;
  evidence_text: string;
  source_type: SourceType;
}

export interface InputField {
  field: string;
  value: number | null;
  /** Non-numeric values: ISO 8601 date, text, or "true"/"false". Numbers stay in `value`. */
  text_value: string | null;
  value_range: [number, number] | null;
  unit: string;
  status: Status;
  evidence: Evidence | null;
  confirmed_by_user: boolean;
  request: string | null;
}

export interface EngineInput {
  scenario_id: string;
  roof_replacement_year: InputField;
  roof_replacement_cost: InputField;
  removal_reinstall_cost: InputField;
  annual_kwh: InputField;
  solar_capex: InputField;
  om_cost_per_year: InputField;
  electricity_value_per_kwh: InputField;
  downtime_fraction: number;
  unallocated_share: number;
  tenant_share: number;
  horizon_years: number;
  discount_rate: number;
  degradation: number;
  /** Annual real escalation of electricity value (default 0). */
  escalation_rate: number;
}

export interface YearSplit {
  year: number;
  kwh: number;
  total_value: number;
  unallocated_value: number;
  owner_value: number;
  tenant_value: number;
}

export interface ScheduleResult {
  schedule: Schedule;
  owner_npv: number;
  tenant_first_full_year_savings: number;
  years: YearSplit[];
  break_even_removal_cost: number | null;
  sources: string[];
}

export interface EngineResult {
  scenario_id: string;
  model_version: string;
  results: ScheduleResult[];
  mutual_benefit_range: [number, number] | null;
  notes: string[];
}

export interface CoordinatorOutput {
  scenario_id: string;
  proposed_range: [number, number] | null;
  rationale: string;
  owner_explanation: string;
  tenant_explanation: string;
  language: Language;
  terms_to_confirm: string[];
  labels: string[];
}

export const SCHEDULE_LABELS: Record<Schedule, string> = {
  solar_now_remove_later: 'Solar now, remove & reinstall at roof replacement',
  roof_and_solar_now: 'Replace roof now, solar now',
  roof_then_solar: 'Roof at planned year, solar then',
};
