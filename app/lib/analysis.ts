import type { EngineInput, InputField } from './contract';
import { FIELD_DEFINITIONS, MODEL_FIELDS } from './fieldDefinitions';

export type AnalysisDraft = Record<string, string>;

const NESTED_FIELDS = [
  'roof_replacement_year',
  'roof_replacement_cost',
  'removal_reinstall_cost',
  'annual_kwh',
  'solar_capex',
  'om_cost_per_year',
  'electricity_value_per_kwh',
] as const;

type NestedFieldKey = (typeof NESTED_FIELDS)[number];

const UNITS: Record<NestedFieldKey, string> = {
  roof_replacement_year: 'years_from_today',
  roof_replacement_cost: 'USD',
  removal_reinstall_cost: 'USD',
  annual_kwh: 'kWh',
  solar_capex: 'USD',
  om_cost_per_year: 'USD/year',
  electricity_value_per_kwh: 'USD/kWh',
};

const EXTRACTED_TO_DRAFT: Record<string, string> = {
  building_name: 'project_name',
  building_address: 'building_address',
  roof_area_sq_ft: 'roof_area_sq_ft',
  roof_type: 'roof_type',
  roof_remaining_life_years: 'roof_remaining_life_years',
  report_date: 'report_date',
  inspection_limitations: 'inspection_limitations',
  structural_capacity_assessed: 'structural_review_status',
  utility_provider: 'utility_provider',
  meter_configuration: 'meter_configuration',
  who_pays_electricity: 'who_pays_electricity',
  roof_replacement_year: 'roof_replacement_year',
  roof_replacement_cost: 'roof_replacement_cost',
  removal_reinstall_cost: 'removal_reinstall_cost',
  annual_kwh: 'annual_kwh',
  solar_capex: 'solar_capex',
  om_cost_per_year: 'om_cost_per_year',
  electricity_value_per_kwh: 'electricity_value_per_kwh',
};

export function emptyAnalysisDraft(): AnalysisDraft {
  return Object.fromEntries(FIELD_DEFINITIONS.map((field) => [field.key, '']));
}

export function draftFromScenario(input: EngineInput | null, projectDetails: Record<string, string>): AnalysisDraft {
  const draft = { ...emptyAnalysisDraft(), ...projectDetails };
  if (!input) return draft;
  draft.project_name = projectDetails.project_name || input.scenario_id;
  for (const key of NESTED_FIELDS) {
    const value = input[key].value;
    draft[key] = value == null ? '' : String(value);
  }
  draft.downtime_percent = String(input.downtime_fraction * 100);
  draft.unallocated_percent = String(input.unallocated_share * 100);
  draft.tenant_percent = String(input.tenant_share * 100);
  draft.horizon_years = String(input.horizon_years);
  draft.discount_rate_percent = String(input.discount_rate * 100);
  draft.degradation_percent = String(input.degradation * 100);
  draft.escalation_rate_percent = String(input.escalation_rate * 100);
  return draft;
}

export function validateDraft(draft: AnalysisDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of FIELD_DEFINITIONS) {
    const raw = (draft[field.key] ?? '').trim();
    if (field.required && !raw) {
      errors[field.key] = 'Required for this analysis.';
      continue;
    }
    if (field.input_type !== 'number' || !raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) errors[field.key] = 'Enter a valid number.';
    else if (field.min != null && value < field.min) errors[field.key] = `Must be at least ${field.min}.`;
    else if (field.max != null && value > field.max) errors[field.key] = `Must be no more than ${field.max}.`;
  }
  return errors;
}

function makeInputField(key: NestedFieldKey, rawValue: string, extractedFields: InputField[]): InputField {
  const value = Number(rawValue);
  const extracted = extractedFields.find((field) => field.field === key);
  const sameAsExtraction = extracted?.value != null && Math.abs(extracted.value - value) < 1e-9;
  const confirmedExtraction = Boolean(
    sameAsExtraction && extracted?.status === 'confirmed' && extracted.confirmed_by_user,
  );
  return {
    field: key,
    value,
    text_value: null,
    value_range: null,
    unit: UNITS[key],
    status: confirmedExtraction ? 'confirmed' : 'human_supplied',
    evidence: confirmedExtraction ? extracted?.evidence ?? null : null,
    confirmed_by_user: true,
    request: null,
  };
}

export function buildEngineInput(draft: AnalysisDraft, extractedFields: InputField[]): EngineInput {
  return {
    scenario_id: draft.project_name.trim(),
    roof_replacement_year: makeInputField('roof_replacement_year', draft.roof_replacement_year, extractedFields),
    roof_replacement_cost: makeInputField('roof_replacement_cost', draft.roof_replacement_cost, extractedFields),
    removal_reinstall_cost: makeInputField('removal_reinstall_cost', draft.removal_reinstall_cost, extractedFields),
    annual_kwh: makeInputField('annual_kwh', draft.annual_kwh, extractedFields),
    solar_capex: makeInputField('solar_capex', draft.solar_capex, extractedFields),
    om_cost_per_year: makeInputField('om_cost_per_year', draft.om_cost_per_year, extractedFields),
    electricity_value_per_kwh: makeInputField('electricity_value_per_kwh', draft.electricity_value_per_kwh, extractedFields),
    downtime_fraction: Number(draft.downtime_percent) / 100,
    unallocated_share: Number(draft.unallocated_percent) / 100,
    tenant_share: Number(draft.tenant_percent) / 100,
    horizon_years: Number(draft.horizon_years),
    discount_rate: Number(draft.discount_rate_percent) / 100,
    degradation: Number(draft.degradation_percent) / 100,
    escalation_rate: Number(draft.escalation_rate_percent) / 100,
  };
}

export function modelFieldsComplete(draft: AnalysisDraft): boolean {
  return MODEL_FIELDS.every((field) => {
    const raw = (draft[field.key] ?? '').trim();
    return raw !== '' && (field.input_type !== 'number' || Number.isFinite(Number(raw)));
  });
}

export function draftKeyForExtractedField(fieldName: string): string | null {
  return EXTRACTED_TO_DRAFT[fieldName] ?? null;
}

export function extractedFieldValue(field: InputField): string {
  if (field.value_range) return `${field.value_range[0]}–${field.value_range[1]}`;
  if (field.value != null) return String(field.value);
  const text = field.text_value ?? '';
  if (field.field === 'report_date') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const match = text.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})$/);
    if (match) {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${match[3]}-${String(months.indexOf(match[1]) + 1).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
    }
  }
  return text;
}

export function applyExtractedField(draft: AnalysisDraft, field: InputField): AnalysisDraft {
  const target = draftKeyForExtractedField(field.field);
  if (!target) return draft;
  return { ...draft, [target]: extractedFieldValue(field) };
}

export function contextDetailsFromDraft(draft: AnalysisDraft): Record<string, string> {
  return Object.fromEntries(
    FIELD_DEFINITIONS.filter((field) => !field.required_for_model).map((field) => [field.key, draft[field.key] ?? '']),
  );
}
