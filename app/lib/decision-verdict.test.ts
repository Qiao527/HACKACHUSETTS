import { describe, expect, it } from 'vitest';
import type { EngineResult } from './contract';
import {
  formatContinuousPercent,
  getDecisionVerdict,
  wholePercentRange,
} from './decision-verdict';

const roofYearFourRange: [number, number] = [
  8.43866901936759e-8,
  0.1914680017321673,
];

function result(
  ownerNpv: number,
  tenantSavings: number,
  range: [number, number] | null = roofYearFourRange,
): EngineResult {
  return {
    scenario_id: 'verdict-test',
    model_version: 'test',
    results: [
      {
        schedule: 'solar_now_remove_later',
        owner_npv: ownerNpv,
        tenant_first_full_year_savings: tenantSavings,
        years: [],
        break_even_removal_cost: null,
        sources: [],
      },
    ],
    mutual_benefit_range: range,
    notes: [],
  };
}

describe('getDecisionVerdict', () => {
  it.each([
    ['default 10%', 56_280.97, 5_925.11],
    ['roof-year-4 10%', 60_352.52, 5_925.11],
    ['roof-year-4 18%', 7_566.83, 10_665.19],
    ['roof-year-4 19%', 968.62, 11_257.7],
  ])('labels %s as both modeled outcomes positive', (_name, owner, tenant) => {
    expect(getDecisionVerdict(result(owner, tenant)).message).toBe(
      'Both modeled project and building-user outcomes are positive.',
    );
  });

  it('labels 0% tenant share as zero tenant savings', () => {
    expect(getDecisionVerdict(result(126_334.66, 0)).message).toBe(
      'Building-user first-year savings are zero.',
    );
  });

  it('labels a negative current owner outcome precisely', () => {
    expect(getDecisionVerdict(result(-5, 12_000)).message).toBe(
      'Project-side incremental NPV is negative.',
    );
  });

  it('reports when no Positive-Outcome Range exists', () => {
    expect(getDecisionVerdict(result(-5, 0, null)).message).toBe(
      'No Positive-Outcome Range exists for the current inputs.',
    );
  });

  it('reports an update while no current result exists', () => {
    expect(getDecisionVerdict(null).message).toBe('Updating current project…');
  });
});

describe('range presentation', () => {
  it('keeps continuous engine bounds distinct from whole-percent slider positions', () => {
    expect(formatContinuousPercent(roofYearFourRange[0])).toBe('0.000008%');
    expect(formatContinuousPercent(roofYearFourRange[1])).toBe('19.1468%');
    expect(wholePercentRange(roofYearFourRange)).toEqual([1, 19]);
  });

  it('never invents a whole-percent position when none lies inside the range', () => {
    expect(wholePercentRange([0.101, 0.109])).toBeNull();
  });
});
