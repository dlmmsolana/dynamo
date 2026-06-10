import { fmt } from './format';
import { detectPoolType } from './pools';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildDonutChart(pairs: any[], totalTVL: number): string {
  const groups: Record<string, { tvl: number; color: string }> = {};
  pairs.forEach(p => {
    const tv = parseFloat(p.liquidity?.usd || 0);
    if (tv <= 0) return;
    const pt = detectPoolType(p);
    if (!groups[pt.group]) groups[pt.group] = { tvl: 0, color: pt.color };
    groups[pt.group].tvl += tv;
  });

  const entries = Object.entries(groups).sort((a, b) => b[1].tvl - a[1].tvl);
  if (!entries.length) return '';

  const size = 160, cx = 80, cy = 80, r = 62, ri = 38;
  let angle = -Math.PI / 2;
  let slices = '', legendItems = '';

  entries.forEach(([name, { tvl, color }]) => {
    const pct = tvl / totalTVL;
    const sweep = pct * 2 * Math.PI;
    if (sweep < 0.01) return;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + sweep), y2 = cy + r * Math.sin(angle + sweep);
    const xi1 = cx + ri * Math.cos(angle), yi1 = cy + ri * Math.sin(angle);
    const xi2 = cx + ri * Math.cos(angle + sweep), yi2 = cy + ri * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    slices += `<path d="M${xi1.toFixed(1)},${yi1.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} L${xi2.toFixed(1)},${yi2.toFixed(1)} A${ri},${ri} 0 ${large},0 ${xi1.toFixed(1)},${yi1.toFixed(1)} Z" fill="${color}" opacity="0.85"/>`;
    legendItems += `<div class="chart-legend-item">
      <div class="chart-legend-dot" style="background:${color};"></div>
      <span class="chart-legend-label">${name}</span>
      <span class="chart-legend-val">${fmt(tvl)}</span>
      <span class="chart-legend-pct">${(pct * 100).toFixed(1)}%</span>
    </div>`;
    angle += sweep;
  });

  return `<div class="chart-wrap">
    <div class="chart-canvas-wrap">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        ${slices}
        <circle cx="${cx}" cy="${cy}" r="${ri - 1}" fill="#0f0f0f"/>
        <text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="#e8e8e6" font-size="13" font-weight="500" font-family="SF Mono,Fira Code,monospace">${fmt(totalTVL)}</text>
        <text x="${cx}" y="${cy + 9}" text-anchor="middle" fill="#555552" font-size="9" font-family="SF Mono,Fira Code,monospace">TOTAL TVL</text>
      </svg>
    </div>
    <div class="chart-legend">${legendItems}</div>
  </div>`;
}
