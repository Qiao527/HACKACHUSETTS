'use client';
import { useEffect, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { runSweep, type SweepResponse } from '../lib/api';
import type { EngineInput } from '../lib/contract';
import { formatContinuousPercent, wholePercentRange } from '../lib/decision-verdict';
import { money } from '../lib/format';
import { LatestRequest } from '../lib/latest-request';
import { ANALYZED_SCHEDULE } from '../lib/scenario';

interface Props {
  input: EngineInput;
  inputRevision: number;
}

export interface AllocationDatum {
  share: number;
  owner: number;
  tenant: number;
}

export function formatCurrencyTick(value: number): string {
  const absoluteValue = Math.abs(value);
  const magnitude = absoluteValue >= 1000
    ? `${Math.round(absoluteValue / 1000)}k`
    : Math.round(absoluteValue).toLocaleString('en-US');
  return `${value < 0 ? '-' : ''}$${magnitude}`;
}

export function AllocationOutcomeChart({
  data,
  dataKey,
  label,
  color,
  zone,
  currentShare,
  fixedWidth,
}: {
  data: AllocationDatum[];
  dataKey: 'owner' | 'tenant';
  label: string;
  color: string;
  zone: [number, number] | null;
  currentShare: number;
  fixedWidth?: number;
}) {
  const chart = (
    <LineChart
      width={fixedWidth}
      height={230}
      data={data}
      margin={{ top: 12, right: 24, bottom: 24, left: 8 }}
    >
      <CartesianGrid stroke="#ededf3" />
      <XAxis
        type="number"
        dataKey="share"
        domain={[0, 100]}
        ticks={[0, 25, 50, 75, 100]}
        tickFormatter={(value) => `${value}%`}
        label={{
          value: 'Tenant share of allocatable value',
          position: 'bottom',
          offset: 0,
          fill: '#554e7b',
        }}
        stroke="#70707d"
      />
      <YAxis tickFormatter={formatCurrencyTick} stroke="#70707d" width={56} />
      <Tooltip
        formatter={(value: number) => [money(value), label]}
        labelFormatter={(value) => `Tenant share ${value}%`}
        contentStyle={{ borderRadius: 8, border: '1px solid #ededf3' }}
      />
      <ReferenceLine y={0} stroke="#70707d" strokeDasharray="2 2" />
      {zone && (
        <ReferenceArea
          x1={zone[0] * 100}
          x2={zone[1] * 100}
          fill="#5266eb"
          fillOpacity={0.12}
        />
      )}
      <ReferenceLine
        x={currentShare}
        stroke="#9cb4e8"
        label={{ value: 'current', position: 'top', fill: '#554e7b', fontSize: 11 }}
      />
      <Line
        type="monotone"
        dataKey={dataKey}
        name={label}
        stroke={color}
        strokeWidth={2}
        dot={false}
      />
    </LineChart>
  );

  return (
    <div>
      <h4 className="mb-2 text-sm text-ink">{label}</h4>
      {fixedWidth ? chart : (
        <ResponsiveContainer width="100%" height={230}>
          {chart}
        </ResponsiveContainer>
      )}
    </div>
  );
}

function AllocationChartPlaceholder({
  message,
  horizonYears,
  error = false,
}: {
  message: string;
  horizonYears: number;
  error?: boolean;
}) {
  const labels = [
    `Owner incremental NPV (${horizonYears}-year horizon)`,
    'Tenant savings (first full operating year)',
  ];
  return (
    <div className="space-y-5 rounded-md bg-surface p-4" style={{ border: '1px solid #ededf3' }}>
      {labels.map((label) => (
        <div key={label}>
          <h4 className="mb-2 text-sm text-ink">{label}</h4>
          <div
            className={`flex h-[230px] items-center justify-center rounded-sm bg-surface-tint px-4 text-center text-sm ${error ? 'text-danger' : 'text-ink-secondary'}`}
            role="status"
          >
            {message}
          </div>
        </div>
      ))}
    </div>
  );
}

// Separate plots share the tenant-share axis but use independent dollar axes so
// a long-horizon NPV is never presented as magnitude-comparable to one-year savings.
export function AllocationChart({ input, inputRevision }: Props) {
  const [sweep, setSweep] = useState<{ revision: number; value: SweepResponse } | null>(null);
  const [error, setError] = useState<{ revision: number; message: string } | null>(null);
  const requests = useRef(new LatestRequest());

  useEffect(() => {
    const request = requests.current.begin();
    setSweep(null);
    setError(null);

    runSweep(input, ANALYZED_SCHEDULE, 41)
      .then((nextSweep) => {
        if (requests.current.isCurrent(request)) {
          setSweep({ revision: inputRevision, value: nextSweep });
        }
      })
      .catch((e) => {
        if (requests.current.isCurrent(request)) {
          setError({
            revision: inputRevision,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      });

    return () => requests.current.invalidate();
  }, [input, inputRevision]);

  const currentError = error?.revision === inputRevision ? error.message : null;
  if (currentError) {
    return (
      <AllocationChartPlaceholder
        message={`Could not load allocation: ${currentError}`}
        horizonYears={input.horizon_years}
        error
      />
    );
  }
  const currentSweep = sweep?.revision === inputRevision ? sweep.value : null;
  if (!currentSweep) {
    return (
      <AllocationChartPlaceholder
        message="Updating current scenario…"
        horizonYears={input.horizon_years}
      />
    );
  }

  const data = currentSweep.points.map((point) => ({
    share: point.tenant_share * 100,
    owner: Math.round(point.owner_npv),
    tenant: Math.round(point.tenant_first_full_year_savings),
  }));
  const zone = currentSweep.mutual_benefit_range;
  const currentShare = Math.round(input.tenant_share * 100);
  const sliderRange = wholePercentRange(zone);

  return (
    <div>
      <div className="space-y-5 rounded-md bg-surface p-4" style={{ border: '1px solid #ededf3' }}>
        <AllocationOutcomeChart
          data={data}
          dataKey="owner"
          label={`Owner incremental NPV (${input.horizon_years}-year horizon)`}
          color="#5266eb"
          zone={zone}
          currentShare={currentShare}
        />
        <AllocationOutcomeChart
          data={data}
          dataKey="tenant"
          label="Tenant savings (first full operating year)"
          color="#2f8f5b"
          zone={zone}
          currentShare={currentShare}
        />
      </div>

      {zone ? (
        <p className="mt-3 text-sm text-ink-secondary">
          Positive-Outcome Range: continuous engine bounds{' '}
          <strong className="text-ink">{formatContinuousPercent(zone[0])}</strong>–
          <strong className="text-ink">{formatContinuousPercent(zone[1])}</strong>.
          Whole-percentage slider positions: <strong className="text-ink">
            {sliderRange ? `${sliderRange[0]}%–${sliderRange[1]}%` : 'none'}
          </strong>. For the analyzed schedule, owner incremental NPV and tenant
          first-full-year savings are each greater than zero. This range does not establish
          owner–tenant agreement.
        </p>
      ) : (
        <p className="mt-3 rounded-sm bg-[#9a6a000f] px-3 py-2 text-sm text-warn">
          No Positive-Outcome Range exists for the analyzed schedule and current inputs.
          Allocation redistributes value; it cannot create value. This does not decide whether
          the parties can reach agreement.
        </p>
      )}
      <p className="mt-2 text-xs text-ink-secondary">
        The range compares each metric only with zero. The dollar magnitudes are not directly
        comparable because they cover different periods.
      </p>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-primary">Chart data as a table</summary>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only">
            Owner incremental NPV over {input.horizon_years} years and tenant savings in the first
            full operating year by tenant share.
          </caption>
          <thead>
            <tr className="text-left text-ink-secondary">
              <th className="py-1 pr-4">Tenant share</th>
              <th className="py-1 pr-4">Owner NPV ({input.horizon_years} years)</th>
              <th className="py-1">Tenant savings (first full year)</th>
            </tr>
          </thead>
          <tbody>
            {data
              .filter((_, index) => index % 5 === 0)
              .map((row) => (
                <tr key={row.share} style={{ borderTop: '1px solid #ededf3' }}>
                  <td className="py-1 pr-4">{row.share}%</td>
                  <td className="py-1 pr-4">{money(row.owner)}</td>
                  <td className="py-1">{money(row.tenant)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
