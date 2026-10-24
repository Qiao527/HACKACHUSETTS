'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SCHEDULE_LABELS, type EngineResult } from '../lib/contract';
import { money } from '../lib/format';

// The three plans vs one roof-only baseline (owner incremental NPV). Used on
// the timing screen and in the brief.
export function ScheduleChart({ result }: { result: EngineResult }) {
  const data = result.results.map((r) => ({
    key: r.schedule,
    name: SCHEDULE_LABELS[r.schedule],
    short:
      r.schedule === 'solar_now_remove_later'
        ? 'Solar now'
        : r.schedule === 'roof_and_solar_now'
          ? 'Roof + solar now'
          : 'Roof then solar',
    npv: Math.round(r.owner_npv),
  }));

  return (
    <div>
      <div className="rounded-md bg-surface p-4" style={{ border: '1px solid #ededf3' }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 20, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="#ededf3" vertical={false} />
            <XAxis dataKey="short" stroke="#70707d" />
            <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} stroke="#70707d" width={56} />
            <Tooltip
              formatter={(v: number) => [money(v), 'Owner incremental NPV']}
              contentStyle={{ borderRadius: 8, border: '1px solid #ededf3' }}
            />
            <ReferenceLine y={0} stroke="#70707d" />
            <Bar dataKey="npv" radius={[6, 6, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.key} fill={d.npv >= 0 ? '#5266eb' : '#b4324a'} />
              ))}
              <LabelList dataKey="npv" position="top" formatter={(v: number) => money(v)} fill="#554e7b" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-ink-secondary">
        Owner incremental NPV vs. a single roof-only baseline (roof replaced at its
        planned year, no solar). The roof cost is charged once in every plan; plans
        differ only in its timing.
      </p>
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">Owner incremental NPV for each schedule.</caption>
        <thead>
          <tr className="text-left text-ink-secondary">
            <th className="py-1 pr-4">Schedule</th>
            <th className="py-1">Owner incremental NPV</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key} style={{ borderTop: '1px solid #ededf3' }}>
              <td className="py-1 pr-4">{d.name}</td>
              <td className="py-1" style={{ color: d.npv >= 0 ? '#2f8f5b' : '#b4324a' }}>
                {money(d.npv)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
