// HTML-string builders for the Simulator results. Pure TS, no React.
// Reuses .mrow/.mc2, .dtable, .analysis, .abar classes from globals.css.

import { fmt } from '../auditor/format';
import type { DammResult } from './damm';
import type { DlmmResult, Side, Shape } from './dlmm';

const GREEN = '#1D9E75';
const RED = '#D85A30';
const BLUE = '#378ADD';

// Exact dollar figure — whole dollars with thousands separators (cents under $100).
// Used for all LP value / per-side figures so they aren't rounded to $1K/$2K.
function usd(v: number): string {
  if (!isFinite(v)) return '—';
  const a = Math.abs(v);
  const body = a > 0 && a < 100 ? a.toFixed(2) : Math.round(a).toLocaleString('en-US');
  return (v < 0 ? '-$' : '$') + body;
}

function num(n: number, dp = 4): string {
  if (!isFinite(n)) return '—';
  if (n === 0) return '0';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toPrecision(dp);
}

function priceLabel(p: number): string {
  if (p >= 0.01) return '$' + p.toFixed(p >= 1 ? 4 : 5);
  return '$' + p.toPrecision(3);
}

const NOTE =
  '<div style="font-size:10px;color:#9c9c97;margin-top:10px;">Price appreciation only — no trading fees, no rebalancing, no time decay. Projection assumes a static position.</div>';

// ── DAMM ─────────────────────────────────────────────────────────────
export function renderDammResult(r: DammResult, meta: { currency: string; entryMC: number }): string {
  if (!r.rows.length) {
    return '<span class="ph2">Enter a starting LP value and entry market cap.</span>';
  }

  const rows = r.rows
    .map((row) => {
      const up = row.vsHold >= 0;
      const pnl = row.value - r.v0;
      const pnlUp = pnl >= 0;
      const atEntry = Math.abs(row.mc - meta.entryMC) / meta.entryMC < 1e-9;
      return `<tr${atEntry ? ' style="background:rgba(255,255,255,0.03);"' : ''}>
        <td>${fmt(row.mc)}${atEntry ? ' <span style="color:#bdbdb7;">· entry</span>' : ''}</td>
        <td><span class="amt">${usd(row.value)}</span></td>
        <td style="white-space:nowrap;">${usd(row.tokenSide)} <span style="color:#9c9c97;">/</span> ${usd(row.quoteSide)}</td>
        <td style="color:${pnlUp ? GREEN : RED};font-weight:500;">${pnlUp ? '+' : ''}${usd(pnl)}</td>
        <td style="color:${row.multiple >= 1 ? GREEN : RED};">${row.multiple.toFixed(2)}×</td>
        <td style="color:${up ? GREEN : RED};">${up ? '+' : ''}${usd(row.vsHold)}<div class="sub">hold: ${usd(row.holdValue)}</div></td>
      </tr>`;
    })
    .join('');

  return `
    <div class="mrow">
      <div class="mc2"><div class="ml">Starting LP Value</div><div class="mv">${usd(r.v0)}</div></div>
      <div class="mc2"><div class="ml">Entry Market Cap</div><div class="mv">${fmt(r.entryMC)}</div></div>
      <div class="mc2"><div class="ml">Pool Type</div><div class="mv" style="color:${GREEN};">DAMM v2</div><div class="ms">full-range · 50/50</div></div>
      <div class="mc2"><div class="ml">Quote</div><div class="mv">${meta.currency}</div></div>
    </div>

    <div class="sl" style="margin-top:14px;">Projected LP value by market cap</div>
    <div style="border:0.5px solid rgba(255,255,255,0.08);border-radius:6px;overflow-x:auto;">
      <table class="dtable">
        <thead><tr><th>Market Cap</th><th>LP Value</th><th>Token / Quote Side</th><th>PnL</th><th>Multiple</th><th>vs. Holding</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="analysis">
      <div class="analysis-label">◈ How this position behaves</div>
      <p>A full-range DAMM (constant-product) position grows with the <strong>square root</strong> of price. Doubling the market cap raises LP value by ~1.41×, not 2× — the gap to a straight hold is impermanent loss, shown in the last column. There is no range to exit and no rebalancing burden, so the position captures appreciation indefinitely but always lags a pure hold on the way up (and loses less than a hold on the way down).</p>
      <p>At every market cap the position stays <strong>50% token / 50% quote by value</strong> — that's why the Token Side and Quote Side dollar figures are always equal. The "vs. Holding" column compares against keeping the original ${usd(r.v0 / 2)} of token plus ${usd(r.v0 / 2)} of quote untouched; fees (not modeled here) are what compensate an LP for this divergence.</p>
    </div>
    ${NOTE}`;
}

// ── DLMM ─────────────────────────────────────────────────────────────
const SIDE_LABEL: Record<Side, string> = {
  two: '2-sided',
  'dca-in': '1-sided DCA-in (buy)',
  'dca-out': '1-sided DCA-out (sell)',
};
const SHAPE_LABEL: Record<Shape, string> = {
  spot: 'Spot',
  curve: 'Curve',
  bidask: 'Bid-Ask',
};

export function renderDlmmResult(
  r: DlmmResult,
  meta: { side: Side; shape: Shape; binStep: number; low: number; high: number; entryPrice: number; currency: string }
): string {
  if (!r.bins.length) {
    return '<span class="ph2">Enter a valid range (low &lt; high), bin step, entry price, and deposit amounts.</span>';
  }

  const maxVal = Math.max(...r.rows.map((x) => x.value), r.entryValue, 1);

  const rows = r.rows
    .map((row) => {
      const isEntry = Math.abs(row.price - meta.entryPrice) / meta.entryPrice < 1e-6;
      const isLow = Math.abs(row.price - meta.low) / meta.low < 1e-6;
      const isHigh = Math.abs(row.price - meta.high) / meta.high < 1e-6;
      const tag = isEntry ? ' <span style="color:#bdbdb7;">· entry</span>' : isLow ? ' <span style="color:' + BLUE + ';">· bottom</span>' : isHigh ? ' <span style="color:' + RED + ';">· top</span>' : '';
      const barW = Math.max(2, (row.value / maxVal) * 100);
      return `<tr${isEntry ? ' style="background:rgba(255,255,255,0.03);"' : ''}>
        <td>${priceLabel(row.price)}${tag}</td>
        <td>${row.mc !== null ? fmt(row.mc) : '—'}</td>
        <td><span class="amt">${usd(row.value)}</span>
          <div class="abar" style="height:4px;margin-top:4px;"><div class="fdl" style="width:${barW}%;"></div><div style="background:#222;flex:1;"></div></div></td>
        <td style="color:${row.multiple >= 1 ? GREEN : RED};">${row.multiple.toFixed(2)}×</td>
        <td>${num(row.baseTokens)}</td>
        <td>${usd(row.quoteHeld)}</td>
      </tr>`;
    })
    .join('');

  const bottomMult = r.depositValue > 0 ? r.bottomValue / r.depositValue : 0;
  const topMult = r.depositValue > 0 ? r.topValue / r.depositValue : 0;

  return `
    <div class="mrow">
      <div class="mc2"><div class="ml">Deposit Value</div><div class="mv">${usd(r.depositValue)}</div><div class="ms">entry ≈ ${usd(r.entryValue)}</div></div>
      <div class="mc2"><div class="ml">At Range Bottom</div><div class="mv" style="color:${BLUE};">${usd(r.bottomValue)}</div><div class="ms">${bottomMult.toFixed(2)}× · ${priceLabel(meta.low)}</div></div>
      <div class="mc2"><div class="ml">At Range Top</div><div class="mv" style="color:${RED};">${usd(r.topValue)}</div><div class="ms">${topMult.toFixed(2)}× · ${priceLabel(meta.high)}</div></div>
      <div class="mc2"><div class="ml">Bins</div><div class="mv">${r.binCount}</div><div class="ms">${meta.binStep} bps step</div></div>
    </div>

    <div style="display:flex;align-items:center;gap:8px;margin:10px 0;flex-wrap:wrap;">
      <span class="badge" style="background:${BLUE}22;color:${BLUE};border:0.5px solid ${BLUE}44;font-size:11px;padding:3px 10px;">DLMM</span>
      <span style="font-size:11px;color:#bdbdb7;">${SIDE_LABEL[meta.side]} · ${SHAPE_LABEL[meta.shape]} shape · range ${priceLabel(meta.low)} → ${priceLabel(meta.high)}</span>
    </div>

    <div class="sl">Value across the range</div>
    <div style="border:0.5px solid rgba(255,255,255,0.08);border-radius:6px;overflow-x:auto;">
      <table class="dtable">
        <thead><tr><th>Price</th><th>MC</th><th>LP Value</th><th>×</th><th>Token Qty</th><th>Quote Held</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="analysis">
      <div class="analysis-label">◈ How this position behaves</div>
      ${dlmmNarrative(r, meta)}
    </div>
    ${NOTE}`;
}

function dlmmNarrative(
  r: DlmmResult,
  meta: { side: Side; shape: Shape; binStep: number; low: number; high: number; entryPrice: number }
): string {
  const ps: string[] = [];

  if (meta.side === 'dca-out') {
    ps.push(`This is a <strong>1-sided sell (DCA-out)</strong> position: 100% token deposited across bins from ${priceLabel(meta.low)} to ${priceLabel(meta.high)}, all above the entry. As price climbs, each bin sells its tokens into quote at that bin's price. At the top you hold <strong>${usd(r.topValue)}</strong> entirely in quote — that is the total proceeds of selling the full position laddered up the range.`);
  } else if (meta.side === 'dca-in') {
    ps.push(`This is a <strong>1-sided buy (DCA-in)</strong> position: 100% quote deposited across bins from ${priceLabel(meta.low)} to ${priceLabel(meta.high)}, all below entry. As price falls, each bin spends its quote buying tokens at that bin's price. At the bottom you hold <strong>${usd(r.bottomValue)}</strong> entirely in token — your average entry is laddered down the range.`);
  } else {
    ps.push(`This is a <strong>2-sided</strong> position centered near ${priceLabel(meta.entryPrice)}: bins above entry hold token (sold as price rises), bins below hold quote (deployed into token as price falls). At the range top (${priceLabel(meta.high)}) it converts fully to quote — <strong>${usd(r.topValue)}</strong>; at the bottom (${priceLabel(meta.low)}) fully to token — <strong>${usd(r.bottomValue)}</strong>.`);
  }

  const shapeNote =
    meta.shape === 'bidask'
      ? 'The <strong>Bid-Ask</strong> shape weights liquidity toward the range edges — more token sits in the highest bins (sold at the best prices) and more quote in the lowest bins (buys at the deepest discount), which maximizes captured appreciation versus Spot.'
      : meta.shape === 'curve'
      ? 'The <strong>Curve</strong> shape concentrates liquidity near the center, so most of the position transacts close to entry and comparatively little is left to convert at the extremes — gentler outcomes at the edges than Bid-Ask.'
      : 'The <strong>Spot</strong> shape spreads liquidity uniformly across bins, so the position converts at a roughly even rate through the range.';
  ps.push(shapeNote);

  ps.push(`A tighter bin step concentrates the same capital into more, narrower bins (currently <strong>${r.binCount}</strong> bins at ${meta.binStep} bps) — finer granularity but a narrower effective range per bin. Once price moves beyond the range the position stops changing composition: flat in quote above the top, and scaling linearly with price (fully in token) below the bottom.`);

  return ps.map((p) => `<p>${p}</p>`).join('');
}
