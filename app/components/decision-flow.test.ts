import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import RootLayout from '../layout';
import type {
  CoordinatorOutput,
  EngineInput,
  EngineResult,
  InputField,
} from '../lib/contract';
import { AllocationChart } from './AllocationChart';
import { AllocationToggle } from './AllocationToggle';
import { ProposalPanel } from './ProposalPanel';
import { ScenarioProvider, useScenario } from './ScenarioProvider';

const api = vi.hoisted(() => ({
  getConstants: vi.fn(),
  runEngine: vi.fn(),
  runSweep: vi.fn(),
  coordinate: vi.fn(),
}));

vi.mock('../lib/api', () => api);
vi.mock('next/link', async () => {
  const testReact = await import('react');
  return {
    default: ({ children, href, ...props }: { children?: React.ReactNode; href: string }) =>
      testReact.createElement('a', { ...props, href }, children),
  };
});
vi.mock('recharts', async () => {
  const testReact = await import('react');
  const container = ({ children }: { children?: React.ReactNode }) =>
    testReact.createElement('div', null, children);
  const empty = () => null;
  return {
    CartesianGrid: empty,
    Line: empty,
    LineChart: container,
    ReferenceArea: empty,
    ReferenceLine: empty,
    ResponsiveContainer: container,
    Tooltip: empty,
    XAxis: empty,
    YAxis: empty,
  };
});

function field(name: string, value: number): InputField {
  return {
    field: name,
    value,
    text_value: null,
    value_range: null,
    unit: name === 'roof_replacement_year' ? 'years' : 'USD',
    status: 'human_supplied',
    evidence: null,
    confirmed_by_user: true,
    request: null,
  };
}

function engineInput(roofYear: number, tenantShare: number): EngineInput {
  return {
    scenario_id: 'same-scenario-id',
    roof_replacement_year: field('roof_replacement_year', roofYear),
    roof_replacement_cost: field('roof_replacement_cost', 100),
    removal_reinstall_cost: field('removal_reinstall_cost', 20),
    annual_kwh: field('annual_kwh', 1000),
    solar_capex: field('solar_capex', 500),
    om_cost_per_year: field('om_cost_per_year', 5),
    electricity_value_per_kwh: field('electricity_value_per_kwh', 0.2),
    downtime_fraction: 0.1,
    unallocated_share: 0,
    tenant_share: tenantShare,
    horizon_years: 25,
    discount_rate: 0.07,
    degradation: 0.005,
    escalation_rate: 0,
  };
}

function engineResult(marker: number): EngineResult {
  return {
    scenario_id: 'same-scenario-id',
    model_version: `test-${marker}`,
    results: [
      {
        schedule: 'solar_now_remove_later',
        owner_npv: marker,
        tenant_first_full_year_savings: marker,
        years: [],
        break_even_removal_cost: null,
        sources: [],
      },
    ],
    mutual_benefit_range: [0.2, 0.4],
    notes: [],
  };
}

function coordinatorOutput(explanation: string): CoordinatorOutput {
  return {
    scenario_id: 'same-scenario-id',
    proposed_range: [0.25, 0.35],
    rationale: 'test rationale',
    owner_explanation: explanation,
    tenant_explanation: explanation,
    language: 'en',
    terms_to_confirm: ['test term'],
    labels: ['not legal advice', 'eligibility not verified'],
  };
}

function sweepResult(ownerNpv: number) {
  return {
    schedule: 'solar_now_remove_later',
    points: [
      {
        tenant_share: 0.3,
        owner_npv: ownerNpv,
        tenant_first_full_year_savings: ownerNpv / 10,
      },
    ],
    mutual_benefit_range: [0.2, 0.4] as [number, number],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function findButton(root: ReactTestInstance, label: string): ReactTestInstance {
  return root.findAllByType('button').find((button) =>
    JSON.stringify(button.props.children).includes(label),
  ) as ReactTestInstance;
}

let mounted: ReactTestRenderer | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

beforeEach(() => {
  api.getConstants.mockReset();
  api.runEngine.mockReset();
  api.runSweep.mockReset();
  api.coordinate.mockReset();
});

describe('decision-flow state consistency', () => {
  it('preserves roof year and 30% tenant share when the page child changes', async () => {
    const initialInput = engineInput(4, 0.2);
    const changedInput = engineInput(9, 0.3);
    api.getConstants.mockResolvedValue({ demo_input: initialInput });
    api.runEngine.mockResolvedValueOnce(engineResult(1)).mockResolvedValueOnce(engineResult(2));

    let scenario!: ReturnType<typeof useScenario>;
    function Probe({ page }: { page: string }) {
      scenario = useScenario();
      return React.createElement('span', null, page);
    }

    await act(async () => {
      mounted = create(
        React.createElement(
          RootLayout,
          null,
          React.createElement(Probe, { page: 'timing' }),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      scenario.setInput(changedInput);
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      mounted?.update(
        React.createElement(
          RootLayout,
          null,
          React.createElement(Probe, { page: 'brief' }),
        ),
      );
    });

    expect(scenario.input?.roof_replacement_year.value).toBe(9);
    expect(scenario.input?.tenant_share).toBe(0.3);
    expect(scenario.result?.model_version).toBe('test-2');
  });

  it('never accepts an older engine completion as the current result', async () => {
    const initialInput = engineInput(4, 0.2);
    api.getConstants.mockResolvedValue({ demo_input: initialInput });
    api.runEngine.mockResolvedValueOnce(engineResult(1));

    let scenario!: ReturnType<typeof useScenario>;
    function Probe() {
      scenario = useScenario();
      return null;
    }

    await act(async () => {
      mounted = create(React.createElement(ScenarioProvider, null, React.createElement(Probe)));
      await Promise.resolve();
      await Promise.resolve();
    });

    const older = deferred<EngineResult>();
    const newer = deferred<EngineResult>();
    api.runEngine.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    act(() => scenario.setInput(engineInput(7, 0.25)));
    act(() => scenario.setInput(engineInput(8, 0.3)));

    expect(scenario.result).toBeNull();

    await act(async () => {
      newer.resolve(engineResult(3));
      await newer.promise;
    });
    await act(async () => {
      older.resolve(engineResult(2));
      await older.promise;
    });

    expect(scenario.input?.roof_replacement_year.value).toBe(8);
    expect(scenario.input?.tenant_share).toBe(0.3);
    expect(scenario.result?.model_version).toBe('test-3');
  });

  it('clears the current result and exposes only the current recalculation failure', async () => {
    const initialInput = engineInput(4, 0.2);
    api.getConstants.mockResolvedValue({ demo_input: initialInput });
    api.runEngine.mockResolvedValueOnce(engineResult(1));

    let scenario!: ReturnType<typeof useScenario>;
    function Probe() {
      scenario = useScenario();
      return null;
    }

    await act(async () => {
      mounted = create(React.createElement(ScenarioProvider, null, React.createElement(Probe)));
      await Promise.resolve();
      await Promise.resolve();
    });

    const failed = deferred<EngineResult>();
    api.runEngine.mockReturnValueOnce(failed.promise);
    act(() => scenario.setInput(engineInput(6, 0.3)));

    expect(scenario.result).toBeNull();
    expect(scenario.recalculating).toBe(true);

    await act(async () => {
      failed.reject(new Error('current engine failure'));
      await failed.promise.catch(() => undefined);
    });

    expect(scenario.result).toBeNull();
    expect(scenario.error).toBe('current engine failure');
    expect(scenario.recalculating).toBe(false);
  });

  it('replaces current allocation values with stable updating placeholders', () => {
    const input = engineInput(4, 0.19);
    act(() => {
      mounted = create(
        React.createElement(AllocationToggle, {
          input,
          result: engineResult(968),
          onChange: vi.fn(),
        }),
      );
    });

    expect(JSON.stringify(mounted!.toJSON())).toContain('$968');

    act(() => {
      mounted?.update(
        React.createElement(AllocationToggle, {
          input,
          result: null,
          onChange: vi.fn(),
        }),
      );
    });

    const updating = JSON.stringify(mounted!.toJSON());
    expect(updating).not.toContain('$968');
    expect(updating).toContain('Updating current scenario…');
    expect(updating.match(/Agreement not confirmed/g)).toHaveLength(2);
  });

  it('never renders an allocation sweep from an older input revision', async () => {
    const older = deferred<ReturnType<typeof sweepResult>>();
    const newer = deferred<ReturnType<typeof sweepResult>>();
    api.runSweep.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    await act(async () => {
      mounted = create(
        React.createElement(AllocationChart, {
          input: engineInput(5, 0.2),
          inputRevision: 1,
        }),
      );
    });

    await act(async () => {
      mounted?.update(
        React.createElement(AllocationChart, {
          input: engineInput(8, 0.3),
          inputRevision: 2,
        }),
      );
    });

    await act(async () => {
      older.resolve(sweepResult(111111));
      await older.promise;
    });

    expect(JSON.stringify(mounted!.toJSON())).not.toContain('$111,111');
    expect(JSON.stringify(mounted!.toJSON())).toContain('Updating current scenario');

    await act(async () => {
      newer.resolve(sweepResult(222222));
      await newer.promise;
    });

    expect(JSON.stringify(mounted!.toJSON())).toContain('$222,222');
    expect(JSON.stringify(mounted!.toJSON())).toContain('Positive-Outcome Range');
  });

  it('discards an old proposal when the financial revision changes', async () => {
    const oldRequest = deferred<CoordinatorOutput>();
    const currentRequest = deferred<CoordinatorOutput>();
    api.coordinate.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(currentRequest.promise);

    await act(async () => {
      mounted = create(
        React.createElement(ProposalPanel, { result: engineResult(1), inputRevision: 1 }),
      );
    });

    await act(async () => {
      findButton(mounted!.root, 'Generate proposal').props.onClick();
      await Promise.resolve();
    });

    await act(async () => {
      mounted?.update(
        React.createElement(ProposalPanel, { result: engineResult(2), inputRevision: 2 }),
      );
    });

    await act(async () => {
      oldRequest.resolve(coordinatorOutput('obsolete proposal'));
      await oldRequest.promise;
    });

    expect(JSON.stringify(mounted!.toJSON())).not.toContain('obsolete proposal');
    expect(JSON.stringify(mounted!.toJSON())).not.toContain('Draft — Not Mutually Accepted');

    await act(async () => {
      findButton(mounted!.root, 'Generate proposal').props.onClick();
      await Promise.resolve();
    });
    await act(async () => {
      currentRequest.resolve(coordinatorOutput('current proposal'));
      await currentRequest.promise;
    });

    expect(JSON.stringify(mounted!.toJSON())).toContain('current proposal');
    expect(JSON.stringify(mounted!.toJSON())).toContain('Draft — Not Mutually Accepted');
  });
});
