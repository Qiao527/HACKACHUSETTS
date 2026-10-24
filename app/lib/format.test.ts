import { describe, expect, it } from 'vitest';
import type { EngineInput, InputField } from './contract';
import { confirmField, money, pct, withFieldValue, withScalar } from './format';

// These test display/formatting only. The UI never computes money; these
// helpers format engine output and build edited inputs to send back.

function field(value: number): InputField {
  return {
    field: 'roof_replacement_cost',
    value,
    text_value: null,
    value_range: null,
    unit: 'USD',
    status: 'extracted_unconfirmed',
    evidence: {
      document_id: 'doc.pdf',
      page: 1,
      evidence_text: 'quote',
      source_type: 'synthetic_document',
    },
    confirmed_by_user: false,
    request: null,
  };
}

function baseInput(): EngineInput {
  return {
    scenario_id: 's',
    roof_replacement_year: field(8),
    roof_replacement_cost: field(360000),
    removal_reinstall_cost: field(85000),
    annual_kwh: field(600000),
    solar_capex: field(850000),
    om_cost_per_year: field(9000),
    electricity_value_per_kwh: field(0.19),
    downtime_fraction: 0.5,
    unallocated_share: 0.1,
    tenant_share: 0.4,
    horizon_years: 25,
    discount_rate: 0.06,
    degradation: 0.005,
    escalation_rate: 0,
  };
}

describe('money', () => {
  it('formats whole dollars', () => {
    expect(money(281971.99)).toBe('$281,972');
  });
  it('renders em dash for null', () => {
    expect(money(null)).toBe('—');
  });
});

describe('pct', () => {
  it('renders a fraction as a percent', () => {
    expect(pct(0.225)).toBe('23%');
    expect(pct(0.225, 1)).toBe('22.5%');
  });
});

describe('withFieldValue', () => {
  it('overrides the value and marks the field human_supplied, keeping the original evidence', () => {
    const next = withFieldValue(baseInput(), 'roof_replacement_cost', 400000);
    expect(next.roof_replacement_cost.value).toBe(400000);
    expect(next.roof_replacement_cost.status).toBe('human_supplied');
    expect(next.roof_replacement_cost.confirmed_by_user).toBe(true);
    // original evidence preserved
    expect(next.roof_replacement_cost.evidence?.document_id).toBe('doc.pdf');
  });
});

describe('withScalar / confirmField', () => {
  it('updates a scalar without touching fields', () => {
    const next = withScalar(baseInput(), 'tenant_share', 0.2);
    expect(next.tenant_share).toBe(0.2);
  });
  it('confirms a field', () => {
    const next = confirmField(baseInput(), 'annual_kwh');
    expect(next.annual_kwh.status).toBe('confirmed');
    expect(next.annual_kwh.confirmed_by_user).toBe(true);
  });
});
