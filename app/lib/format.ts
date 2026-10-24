// Display-only helpers. No financial math lives here (ui-rules.md): formatting
// and simple input-object updates only.
import type { EngineInput, InputField } from './contract';

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const USD2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export function money(n: number | null | undefined, cents = false): string {
  if (n == null) return '—';
  return (cents ? USD2 : USD).format(n);
}

export function pct(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function kwh(n: number): string {
  return `${Math.round(n).toLocaleString('en-US')} kWh`;
}

// Produce a new EngineInput with one numeric InputField value overridden and
// marked human_supplied (the UI's edit path). Keeps the original extraction on
// the field so the evidence trail is preserved.
export function withFieldValue(
  input: EngineInput,
  key: keyof EngineInput,
  value: number,
): EngineInput {
  const current = input[key] as InputField;
  const updated: InputField = {
    ...current,
    value,
    status: 'human_supplied',
    confirmed_by_user: true,
  };
  return { ...input, [key]: updated } as EngineInput;
}

export function withScalar(
  input: EngineInput,
  key: 'tenant_share' | 'unallocated_share' | 'downtime_fraction' | 'discount_rate' | 'degradation',
  value: number,
): EngineInput {
  return { ...input, [key]: value };
}

export function confirmField(input: EngineInput, key: keyof EngineInput): EngineInput {
  const current = input[key] as InputField;
  return {
    ...input,
    [key]: { ...current, status: 'confirmed', confirmed_by_user: true },
  } as EngineInput;
}
