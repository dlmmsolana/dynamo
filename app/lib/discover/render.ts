import { fmt } from '../auditor/format';
import { classifyStage, sc } from '../auditor/classify';
import type { DiscToken } from '../../app/api/dexscreener/trending/route';

export type { DiscToken };

export function getDiscVal(t: DiscToken, mode: string, time: string): number {
  if (mode === 'volume') {
    if (time === '1')  return t.volH1  || 0;
    if (time === '4')  return (t.volH6 || 0) * (4 / 6);
    if (time === '12') return ((t.volH6 || 0) + (t.vol24 || 0)) / 2;
    return t.vol24 || 0;
  }
  // mcchange
  if (time === '1')  return t.priceH1 || 0;
  if (time === '4')  return (t.priceH6 || 0) * (4 / 6);
  if (time === '12') return ((t.priceH6 || 0) + (t.priceChg || 0)) / 2;
  return t.priceChg || 0;
}

export function getDiscTimeLabel(time: string): string {
  return ({ '1': '1h', '4': '~4h', '12': '~12h', '24': '24h' }[time]) || '24h';
}

export function renderDiscCard(t: DiscToken, isAdded: boolean): string {
  const s       = classifyStage(t.mc);
  const c       = sc(s.stage);
  const lr      = t.tvl > 0 && t.mc > 0 ? (t.tvl / t.mc) * 100 : 0;
  const lrColor = lr < 2 ? '#c94a4a' : lr < 5 ? '#BA7517' : '#1D9E75';
  const chColor = t.priceChg >= 0 ? '#1D9E75' : '#c94a4a';
  const priceStr =
    t.price === 0        ? '—'
    : t.price < 0.00001  ? '$' + t.price.toPrecision(3)
    : t.price < 0.01     ? '$' + t.price.toFixed(6)
    : t.price < 1        ? '$' + t.price.toFixed(4)
    :                      '$' + t.price.toFixed(2);

  const addLabel  = isAdded ? '✓ Added' : '+ Portfolio';
  const addDisabled = isAdded ? ' disabled' : '';

  return `<div class="disc-card">
    <div class="disc-header">
      <span class="disc-sym">${t.symbol}</span>
      <span class="disc-name">${t.name}</span>
      <span class="badge" style="background:${c}22;color:${c};border:0.5px solid ${c}44;flex-shrink:0;">S${s.stage}</span>
      <span style="font-size:11px;font-weight:500;color:${chColor};margin-left:auto;flex-shrink:0;">${t.priceChg >= 0 ? '+' : ''}${t.priceChg.toFixed(1)}%</span>
    </div>
    <div class="disc-price">${priceStr}</div>
    <div class="disc-metrics">
      <div class="disc-m"><span class="dl">MC</span><span class="dv">${fmt(t.mc)}</span></div>
      <div class="disc-m"><span class="dl">Vol 24h</span><span class="dv">${fmt(t.vol24)}</span></div>
      <div class="disc-m"><span class="dl">TVL</span><span class="dv">${fmt(t.tvl)}</span></div>
      <div class="disc-m"><span class="dl">Liq Ratio</span><span class="dv" style="color:${lrColor};">${lr.toFixed(1)}%</span></div>
      <div class="disc-m"><span class="dl">Pools</span><span class="dv">${t.pools}</span></div>
    </div>
    <div class="disc-actions">
      <button class="disc-btn primary" onclick="window._dynamo && window._dynamo.openAudit('${t.address}')">⊕ Audit</button>
      <button class="disc-btn" onclick="window._dynamo && window._dynamo.openLiveLP('${t.address}')">⚡ Live LP</button>
      <button class="disc-btn"${addDisabled} onclick="window._dynamo && window._dynamo.addToPortfolio('${t.address}', this)">${addLabel}</button>
    </div>
  </div>`;
}

export function renderDiscGrid(
  tokens: DiscToken[],
  mode: string,
  time: string,
  addedAddresses: Set<string>
): string {
  const sorted = [...tokens].sort((a, b) => getDiscVal(b, mode, time) - getDiscVal(a, mode, time));
  const lbl      = getDiscTimeLabel(time);
  const modeLabel = mode === 'volume' ? `vol ${lbl}` : `price chg ${lbl}`;
  const cards     = sorted.map((t) => renderDiscCard(t, addedAddresses.has(t.address))).join('');
  return `<div style="font-size:10px;color:#555552;margin-bottom:10px;">${tokens.length} tokens · sorted by ${modeLabel}</div><div class="disc-grid">${cards}</div>`;
}
