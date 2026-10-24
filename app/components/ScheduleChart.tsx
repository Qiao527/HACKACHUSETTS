'use client';

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SCHEDULE_LABELS, type EngineResult } from '../lib/contract';
import { money } from '../lib/format';

// Three project pathways against one roof-only baseline. The metric remains the
// contract's owner_npv, displayed as project-side NPV for broader use.
export function ScheduleChart({ result }: { result: EngineResult }) {
  const data = result.results.map((item) => ({
    key: item.schedule,
    name: SCHEDULE_LABELS[item.schedule],
    short: item.schedule === 'solar_now_remove_later' ? 'Solar now' : item.schedule === 'roof_and_solar_now' ? 'Roof + solar now' : 'Roof then solar',
    npv: Math.round(item.owner_npv),
  }));

  return (
    <div>
      <div className="rounded-xl border border-mint-border bg-surface p-4">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 20, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="#d4ebe2" vertical={false} />
            <XAxis dataKey="short" stroke="#66897f" />
            <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} stroke="#66897f" width={56} />
            <Tooltip formatter={(value: number) => [money(value), 'Project-side incremental NPV']} contentStyle={{ borderRadius: 8, border: '1px solid #b9e2d3' }} />
            <ReferenceLine y={0} stroke="#66897f" />
            <Bar dataKey="npv" radius={[6, 6, 0, 0]}>
              {data.map((item) => <Cell key={item.key} fill={item.npv >= 0 ? '#16735b' : '#b33a50'} />)}
              <LabelList dataKey="npv" position="top" formatter={(value: number) => money(value)} fill="#4c6d63" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-ink-secondary">Project-side incremental NPV compared with a roof-only baseline (roof replaced at the planned year, no solar). The roof cost is counted once in every pathway; only its timing changes.</p>
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">Project-side incremental NPV for each roof and solar pathway.</caption>
        <thead><tr className="text-left text-ink-secondary"><th className="py-1 pr-4">Pathway</th><th className="py-1">Project-side incremental NPV</th></tr></thead>
        <tbody>{data.map((item) => <tr key={item.key} className="border-t border-mint-border"><td className="py-1 pr-4">{item.name}</td><td className={`py-1 ${item.npv >= 0 ? 'text-ok' : 'text-danger'}`}>{money(item.npv)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
