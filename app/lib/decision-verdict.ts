import type { EngineResult } from './contract';
import { ANALYZED_SCHEDULE } from './scenario';

export type VerdictTone = 'positive' | 'negative' | 'warning' | 'updating';

export interface DecisionVerdict {
  message: string;
  tone: VerdictTone;
}

export function getDecisionVerdict(result: EngineResult | null): DecisionVerdict {
  if (!result) return { message: 'Updating current project…', tone: 'updating' };
  if (!result.mutual_benefit_range) {
    return { message: 'No Positive-Outcome Range exists for the current inputs.', tone: 'warning' };
  }
  const schedule = result.results.find((item) => item.schedule === ANALYZED_SCHEDULE);
  if (!schedule) return { message: 'Updating current project…', tone: 'updating' };
  if (schedule.owner_npv < 0) return { message: 'Project-side incremental NPV is negative.', tone: 'negative' };
  if (schedule.tenant_first_full_year_savings === 0) return { message: 'Building-user first-year savings are zero.', tone: 'warning' };
  if (schedule.owner_npv > 0 && schedule.tenant_first_full_year_savings > 0) {
    return { message: 'Both modeled project and building-user outcomes are positive.', tone: 'positive' };
  }
  if (schedule.owner_npv === 0) return { message: 'Project-side incremental NPV is zero.', tone: 'warning' };
  return { message: 'Building-user first-year savings are negative.', tone: 'negative' };
}

export function formatContinuousPercent(fraction: number): string {
  const percent = fraction * 100;
  const digits = Math.abs(percent) < 0.0001 && percent !== 0 ? 6 : 4;
  return `${percent.toFixed(digits)}%`;
}

export function wholePercentRange(range: [number, number] | null): [number, number] | null {
  if (!range) return null;
  const lowerPercent = range[0] * 100;
  const upperPercent = range[1] * 100;
  const first = lowerPercent <= 0 ? 0 : Math.ceil(lowerPercent);
  const last = upperPercent >= 100 ? 100 : Math.ceil(upperPercent) - 1;
  return first <= last ? [first, last] : null;
}
