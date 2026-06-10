import { fmt } from './format';

export interface PoolType {
  type: string;
  color: string;
  group: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function detectPoolType(p: any): PoolType {
  const dex = (p.dexId || '').toLowerCase();
  const lbl = ((p.labels || []).join(' ')).toLowerCase();
  const url = (p.url || '').toLowerCase();

  if (dex.includes('meteora')) {
    if (lbl.includes('dlmm') || url.includes('dlmm'))
      return { type: 'DLMM', color: '#378ADD', group: 'Meteora DLMM' };
    if (lbl.includes('damm') || lbl.includes('dynamic') || lbl.includes('dyn'))
      return { type: 'DAMM', color: '#1D9E75', group: 'Meteora DAMM' };
    return { type: 'AMM', color: '#1D9E75', group: 'Meteora AMM' };
  }
  if (dex.includes('orca')) {
    if (lbl.includes('clmm') || lbl.includes('whirlpool') || url.includes('whirlpool'))
      return { type: 'CLMM', color: '#7F77DD', group: 'Orca CLMM' };
    return { type: 'CPMM', color: '#7F77DD', group: 'Orca CPMM' };
  }
  if (dex.includes('raydium')) {
    if (lbl.includes('clmm') || url.includes('clmm'))
      return { type: 'CLMM', color: '#BA7517', group: 'Raydium CLMM' };
    if (lbl.includes('cpmm'))
      return { type: 'CPMM', color: '#BA7517', group: 'Raydium CPMM' };
    return { type: 'AMM', color: '#BA7517', group: 'Raydium AMM' };
  }
  if (dex.includes('pump'))
    return { type: 'Bonding Curve', color: '#D85A30', group: 'PumpSwap' };
  return { type: 'AMM', color: '#555552', group: 'Other' };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function poolLinks(p: any): string {
  const dex = (p.dexId || '').toLowerCase();
  const pa  = p.pairAddress || '';
  const a   = (href: string, color: string, lbl: string) =>
    `<a href="${href}" target="_blank" style="color:${color};text-decoration:none;font-size:10px;border:0.5px solid ${color}44;border-radius:3px;padding:1px 5px;white-space:nowrap;">${lbl} ↗</a>`;
  const out: string[] = [];
  if (p.url) out.push(a(p.url, '#555552', 'DS'));
  if (pa)    out.push(a(`https://solscan.io/account/${pa}`, '#555552', 'SC'));
  if (dex.includes('orca')    && pa) out.push(a(`https://www.orca.so/pools?address=${pa}`,         '#7F77DD', 'Orca'));
  if (dex.includes('meteora') && pa) out.push(a(`https://app.meteora.ag/pools/${pa}`,               '#1D9E75', 'Met'));
  if (dex.includes('raydium') && pa) out.push(a(`https://raydium.io/liquidity/?ammId=${pa}`,        '#BA7517', 'Ray'));
  return out.join(' ');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildPoolRows(pairs: any[]): string {
  return pairs.slice(0, 12).map(p => {
    const tv = parseFloat(p.liquidity?.usd || 0);
    const vo = parseFloat(p.volume?.h24 || 0);
    const fe = vo * 0.003;
    const ut = tv > 0 ? (vo / tv * 100).toFixed(0) + '%' : '—';
    const ch = p.priceChange?.h24 ?? null;
    const pt = detectPoolType(p);
    return `<div class="pr">
      <span style="min-width:110px;color:#888884;font-size:10px;text-transform:uppercase;letter-spacing:.04em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(p.dexId || '?').replace(/_/g, ' ')}</span>
      <span style="min-width:90px;"><span style="background:${pt.color}20;color:${pt.color};border:0.5px solid ${pt.color}50;border-radius:3px;padding:1px 6px;font-size:9px;letter-spacing:.06em;text-transform:uppercase;">${pt.type}</span></span>
      <span style="min-width:75px;">${fmt(tv)}</span>
      <span style="min-width:75px;">${fmt(vo)}</span>
      <span style="min-width:65px;">${fmt(fe)}</span>
      <span style="min-width:50px;color:#888884;">${ut}</span>
      <span style="min-width:60px;color:${ch === null ? '#555552' : ch >= 0 ? '#1D9E75' : '#c94a4a'};">${ch === null ? '—' : (ch >= 0 ? '+' : '') + ch.toFixed(1) + '%'}</span>
      <span style="display:flex;gap:4px;flex-wrap:wrap;">${poolLinks(p)}</span>
    </div>`;
  }).join('');
}
