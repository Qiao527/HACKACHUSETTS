import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  AllocationOutcomeChart,
  formatCurrencyTick,
  type AllocationDatum,
} from './AllocationChart';

const data: AllocationDatum[] = [
  { share: 0, owner: 126335, tenant: 0 },
  { share: 25, owner: -38622, tenant: 14813 },
  { share: 50, owner: -203579, tenant: 29626 },
  { share: 75, owner: -368535, tenant: 44438 },
  { share: 100, owner: -533492, tenant: 59251 },
];

const roofYearFourRange: [number, number] = [
  8.43866901936759e-8,
  0.1914680017321673,
];

function renderChart(currentShare: number): string {
  return renderToStaticMarkup(
    React.createElement(AllocationOutcomeChart, {
      data,
      dataKey: 'owner',
      label: 'Owner incremental NPV (25-year horizon)',
      color: '#5266eb',
      zone: roofYearFourRange,
      currentShare,
      fixedWidth: 600,
    }),
  );
}

function attribute(tag: string, name: string): number {
  const match = tag.match(new RegExp(`${name}="([^"]+)"`));
  if (!match) throw new Error(`Missing ${name} in ${tag}`);
  return Number(match[1]);
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  const original = console.error;
  consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (String(args[0]).includes('Support for defaultProps')) return;
    original(...args);
  });
});

afterAll(() => {
  consoleError.mockRestore();
});

describe('AllocationOutcomeChart numeric coordinates', () => {
  it('renders the roof-year-4 continuous range at its exact engine bounds', () => {
    const markup = renderChart(19);
    const area = markup.match(
      /<path[^>]*class="recharts-rectangle recharts-reference-area-rect"[^>]*>/,
    )?.[0];

    expect(area).toBeDefined();
    expect(attribute(area!, 'x1')).toBeCloseTo(roofYearFourRange[0] * 100, 12);
    expect(attribute(area!, 'x2')).toBeCloseTo(roofYearFourRange[1] * 100, 12);
    expect(attribute(area!, 'width')).toBeGreaterThan(0);
    for (const tick of ['0%', '25%', '50%', '75%', '100%']) {
      expect(markup).toContain(`>${tick}<`);
    }
  });

  it.each([11, 12, 17, 19])('renders the current-share marker at %i%%', (share) => {
    const markup = renderChart(share);
    const referenceLines = markup.match(
      /<line[^>]*class="recharts-reference-line-line"[^>]*>/g,
    );

    expect(referenceLines?.some((line) => line.includes(`x="${share}"`))).toBe(true);
  });

  it('formats negative currency ticks with the sign before the dollar symbol', () => {
    expect(formatCurrencyTick(-18_500)).toBe('-$19k');
    expect(formatCurrencyTick(-500)).toBe('-$500');
    expect(formatCurrencyTick(18_500)).toBe('$19k');
    expect(formatCurrencyTick(0)).toBe('$0');
  });
});
