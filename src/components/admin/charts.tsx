import type { ReactNode } from 'react';

export const CHART_COLORS = ['#2d8a4e', '#d9822b', '#1d5a86', '#9aab9f', '#8a4b21', '#226b3d', '#b3261e', '#64776c'];

/** Horizontal bar list used across the admin dashboard. */
export function BarList({ rows, clay = false, iconKey = null }: {
  rows: { label: string; count: number; icon?: string | null }[];
  clay?: boolean;
  iconKey?: 'icon' | null;
}) {
  if (!rows.length) return <p className="muted small">No data yet.</p>;
  const max = Math.max(1, ...rows.map((r) => r.count || 0));
  return (
    <>
      {rows.map((r, i) => (
        <div className="bar-row" key={i}>
          <span className="bl" title={r.label}>{iconKey && r.icon ? `${r.icon} ` : ''}{r.label}</span>
          <span className="bar-track"><span className={'bar-fill' + (clay ? ' clay' : '')} style={{ width: `${((r.count || 0) / max) * 100}%` }} /></span>
          <span className="bv">{r.count || 0}</span>
        </div>
      ))}
    </>
  );
}

/** Conic-gradient donut with a legend. */
export function Donut({ rows }: { rows: { label: string; count: number }[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  let acc = 0;
  const stops = rows.map((r, i) => {
    const from = (acc / total) * 100;
    acc += r.count;
    const to = (acc / total) * 100;
    return `${CHART_COLORS[i % CHART_COLORS.length]} ${from}% ${to}%`;
  }).join(', ');
  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background: `conic-gradient(${stops})` }} />
      <div className="donut-legend grow">
        {rows.map((r, i) => (
          <div key={i}><i style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />{r.label}<b>{r.count}</b></div>
        ))}
      </div>
    </div>
  );
}

export function ChartBox({ title, children }: { title: string; children: ReactNode }) {
  return <div className="chart-box"><h3>{title}</h3>{children}</div>;
}
