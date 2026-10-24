'use client';

import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Legend,
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
import { money, pct } from '../lib/format';

interface Props {
  input: EngineInput;
  schedule?: string;
}

// x = tenant share 0–100%; two labeled lines (owner NPV, tenant first-year
// savings); the mutual-benefit zone shaded and labeled; a clear message when no
// zone exists. All numbers come from the engine sweep (ui-rules.md).
export function AllocationChart({ input, schedule = 'solar_now_remove_later' }: Props) {
  const [sweep, setSweep] = useState<SweepResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    runSweep(input, schedule, 41)
      .then((s) => active && setSweep(s))
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [input, schedule]);

  if (error) return <p className="text-danger">Could not load chart: {error}</p>;
  if (!sweep) return <p className="text-ink-secondary">Loading allocation…</p>;

  const data = sweep.points.map((p) => ({
    share: Math.round(p.tenant_share * 100),
    owner: Math.round(p.owner_npv),
    tenant: Math.round(p.tenant_first_full_year_savings),
  }));
  const zone = sweep.mutual_benefit_range;
  const currentShare = Math.round(input.tenant_share * 100);

  return (
    <div>
      <div className="rounded-md bg-surface p-4" style={{ border: '1px solid #ededf3' }}>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={data} margin={{ top: 12, right: 24, bottom: 24, left: 8 }}>
            <CartesianGrid stroke="#ededf3" />
            <XAxis
              dataKey="share"
              tickFormatter={(v) => `${v}%`}
              label={{ value: 'Tenant share of allocatable value', position: 'bottom', offset: 0, fill: '#554e7b' }}
              stroke="#70707d"
            />
            <YAxis
              tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
              stroke="#70707d"
              width={56}
            />
            <Tooltip
              formatter={(v: number, name: string) => [money(v), name]}
              labelFormatter={(l) => `Tenant share ${l}%`}
              contentStyle={{ borderRadius: 8, border: '1px solid #ededf3' }}
            />
            <Legend verticalAlign="top" height={28} />
            <ReferenceLine y={0} stroke="#70707d" strokeDasharray="2 2" />
            {zone && (
              <ReferenceArea
                x1={Math.round(zone[0] * 100)}
                x2={Math.round(zone[1] * 100)}
                fill="#5266eb"
                fillOpacity={0.12}
                label={{ value: 'Both positive', position: 'insideTop', fill: '#554e7b', fontSize: 12 }}
              />
            )}
            <ReferenceLine
              x={currentShare}
              stroke="#9cb4e8"
              label={{ value: 'now', position: 'top', fill: '#554e7b', fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="owner"
              name="Owner incremental NPV"
              stroke="#5266eb"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="tenant"
              name="Tenant first-year savings"
              stroke="#2f8f5b"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {zone ? (
        <p className="mt-3 text-sm text-ink-secondary">
          Mutual-benefit zone: tenant share between{' '}
          <strong className="text-ink">{pct(zone[0])}</strong> and{' '}
          <strong className="text-ink">{pct(zone[1])}</strong>. Inside this band both
          owner NPV and tenant first-year savings are positive.
        </p>
      ) : (
        <p className="mt-3 rounded-sm bg-[#9a6a000f] px-3 py-2 text-sm text-warn">
          No mutual-benefit zone exists for this scenario. Allocation redistributes
          value; it cannot create value. This is a valid, honest answer.
        </p>
      )}

      {/* Text alternative for the chart (accessibility). */}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-primary">Chart data as a table</summary>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only">
            Owner incremental NPV and tenant first-year savings by tenant share.
          </caption>
          <thead>
            <tr className="text-left text-ink-secondary">
              <th className="py-1 pr-4">Tenant share</th>
              <th className="py-1 pr-4">Owner NPV</th>
              <th className="py-1">Tenant first-year savings</th>
            </tr>
          </thead>
          <tbody>
            {data
              .filter((_, i) => i % 5 === 0)
              .map((d) => (
                <tr key={d.share} style={{ borderTop: '1px solid #ededf3' }}>
                  <td className="py-1 pr-4">{d.share}%</td>
                  <td className="py-1 pr-4">{money(d.owner)}</td>
                  <td className="py-1">{money(d.tenant)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
