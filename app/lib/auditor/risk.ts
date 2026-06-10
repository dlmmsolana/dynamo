import { fmt } from './format';

interface RiskFlag {
  c: 'red' | 'amber' | 'green';
  pts: number;
  label: string;
  detail: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildRiskSection(mc: number, fdv: number, tvl: number, vol24: number, liqRatio: number, volLiq: number, priceChg: number, pairs: any[]): string {
  const flags: RiskFlag[] = [];
  let score = 0;

  if (liqRatio < 0.5 && mc > 100000) {
    const pts = 28; score += pts;
    flags.push({ c: 'red', pts, label: 'Extreme holder concentration signal', detail: `Liq ratio ${liqRatio.toFixed(2)}% on a ${fmt(mc)} MC token — almost no supply in liquidity pools, strongly suggesting concentrated whale ownership.` });
  } else if (liqRatio < 1 && mc > 50000) {
    const pts = 16; score += pts;
    flags.push({ c: 'amber', pts, label: 'Holder concentration signal', detail: `Liq ratio ${liqRatio.toFixed(2)}% is very low relative to market cap — limited supply distribution.` });
  }

  const fdvRatio = (mc > 0 && fdv > 0) ? fdv / mc : 1;
  if (fdvRatio > 20) {
    const pts = 25; score += pts;
    flags.push({ c: 'red', pts, label: 'Extreme supply overhang', detail: `FDV/MC = ${fdvRatio.toFixed(0)}x — ${((1 - mc / fdv) * 100).toFixed(0)}% of total supply is locked or unvested. Unlock events create severe sell pressure.` });
  } else if (fdvRatio > 5) {
    const pts = 12; score += pts;
    flags.push({ c: 'amber', pts, label: 'Supply overhang', detail: `FDV/MC = ${fdvRatio.toFixed(1)}x — ${((1 - mc / fdv) * 100).toFixed(0)}% of supply not yet circulating. Monitor for unlock schedule.` });
  }

  if (volLiq > 20) {
    const pts = 25; score += pts;
    flags.push({ c: 'red', pts, label: 'Wash trading signal', detail: `Vol/liq = ${volLiq.toFixed(1)}x — organic volume at this ratio is implausible at current pool depth. Likely artificial volume inflating metrics.` });
  } else if (volLiq > 8) {
    const pts = 10; score += pts;
    flags.push({ c: 'amber', pts, label: 'Elevated vol/liq ratio', detail: `Vol/liq = ${volLiq.toFixed(1)}x — above the typical 2–5x range. Monitor for wash-trading activity.` });
  }

  if (tvl < 2000) {
    const pts = 22; score += pts;
    flags.push({ c: 'red', pts, label: 'Critically thin liquidity', detail: `TVL ${fmt(tvl)} — pool depth is insufficient for meaningful trading. Easily manipulated; exit risk is extreme.` });
  } else if (tvl < 10000) {
    const pts = 10; score += pts;
    flags.push({ c: 'amber', pts, label: 'Thin liquidity', detail: `TVL ${fmt(tvl)} — low depth creates elevated exit risk and price manipulation exposure.` });
  }

  const ages = pairs.map((p: any) => p.pairCreatedAt).filter(Boolean);
  if (ages.length > 0) {
    const youngest = Math.min(...ages);
    const ageHours = (Date.now() - youngest) / 3600000;
    if (ageHours < 24) {
      const pts = 18; score += pts;
      flags.push({ c: 'red', pts, label: 'New pool (< 24h)', detail: `Youngest pool created ${ageHours < 1 ? '<1h' : Math.floor(ageHours) + 'h'} ago — no established price history, volume pattern, or holder behavior.` });
    } else if (ageHours < 72) {
      const pts = 8; score += pts;
      flags.push({ c: 'amber', pts, label: 'Young pool (< 72h)', detail: `Pool created ${Math.floor(ageHours)}h ago — still in early volatility phase.` });
    }
  }

  if (priceChg > 200 || priceChg < -70) {
    const pts = 15; score += pts;
    flags.push({ c: 'amber', pts, label: 'Extreme price action', detail: `${priceChg > 0 ? '+' : ''}${priceChg.toFixed(0)}% in 24h — may indicate coordinated pump/dump activity.` });
  } else if (priceChg > 80 || priceChg < -50) {
    const pts = 8; score += pts;
    flags.push({ c: 'amber', pts, label: 'High price volatility', detail: `${priceChg > 0 ? '+' : ''}${priceChg.toFixed(0)}% in 24h — elevated price action warrants caution.` });
  }

  if (pairs.length === 1 && mc > 200000) {
    const pts = 8; score += pts;
    flags.push({ c: 'amber', pts, label: 'Single-pool dependency', detail: `Only 1 pool on a ${fmt(mc)} MC token. Entire tradeable liquidity depends on one pool operator.` });
  }

  const hasBonding = pairs.some((p: any) => {
    const lbl = (p.labels || []).join(' ').toLowerCase();
    const dex = (p.dexId || '').toLowerCase();
    return lbl.includes('bonding') || dex.includes('pump') || lbl.includes('pump');
  });
  if (hasBonding && mc < 100000) {
    const pts = 5; score += pts;
    flags.push({ c: 'amber', pts, label: 'Bonding curve stage', detail: 'Token has not graduated from bonding curve — standard pump.fun dynamics apply. Risk is highest before graduation.' });
  }

  if (liqRatio > 10) {
    const pts = -10; score += pts;
    flags.push({ c: 'green', pts, label: 'Healthy liquidity ratio', detail: `Liq ratio ${liqRatio.toFixed(1)}% — strong community/team commitment to liquid markets.` });
  } else if (liqRatio > 5) {
    const pts = -5; score += pts;
    flags.push({ c: 'green', pts, label: 'Adequate liquidity ratio', detail: `Liq ratio ${liqRatio.toFixed(1)}% — acceptable depth relative to market cap.` });
  }

  const dexSet = new Set(pairs.map((p: any) => p.dexId).filter(Boolean));
  if (dexSet.size >= 2 && pairs.length >= 3) {
    const pts = -5; score += pts;
    flags.push({ c: 'green', pts, label: 'Multi-DEX presence', detail: `Liquidity distributed across ${dexSet.size} DEXes — routing diversity reduces single-venue exit risk.` });
  }

  score = Math.min(100, Math.max(0, score));

  const stubs = [
    { label: 'Mint authority revoked',    detail: 'Requires on-chain verification (Helius RPC — Phase 3)' },
    { label: 'Freeze authority disabled', detail: 'Requires on-chain verification (Helius RPC — Phase 3)' },
    { label: 'LP lock status',            detail: 'Requires on-chain verification (Helius RPC — Phase 3)' },
  ];

  let verdict: string, vc: string, vbg: string;
  if (score < 20)      { verdict = 'Pass';         vc = '#1D9E75'; vbg = '#1D9E7514'; }
  else if (score < 45) { verdict = 'Caution';       vc = '#BA7517'; vbg = '#BA751714'; }
  else if (score < 70) { verdict = 'High Risk';     vc = '#D85A30'; vbg = '#D85A3014'; }
  else                 { verdict = 'Do Not Touch';  vc = '#c94a4a'; vbg = '#c94a4a14'; }

  const dc: Record<string, string> = { red: '#c94a4a', amber: '#BA7517', green: '#1D9E75' };
  const sorted = [
    ...flags.filter(f => f.c === 'red'),
    ...flags.filter(f => f.c === 'amber'),
    ...flags.filter(f => f.c === 'green'),
  ];

  const flagRows = sorted.map(f => `
    <div style="display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-bottom:0.5px solid rgba(255,255,255,0.04);">
      <span style="color:${dc[f.c]};font-size:9px;margin-top:2px;flex-shrink:0;">${f.c === 'green' ? '✓' : '⚑'}</span>
      <div style="min-width:0;">
        <div style="font-size:11px;color:${dc[f.c]};font-weight:500;">${f.label} <span style="color:#555552;font-weight:400;">${f.pts > 0 ? '(+' + f.pts + ' pts)' : '(' + f.pts + ' pts)'}</span></div>
        <div style="font-size:10px;color:#888884;margin-top:2px;line-height:1.4;">${f.detail}</div>
      </div>
    </div>`).join('');

  const stubRows = stubs.map(s => `
    <div style="display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-bottom:0.5px solid rgba(255,255,255,0.04);">
      <span style="color:#555552;font-size:9px;margin-top:2px;flex-shrink:0;">○</span>
      <div>
        <div style="font-size:11px;color:#555552;">${s.label}</div>
        <div style="font-size:10px;color:#555552;margin-top:2px;">${s.detail}</div>
      </div>
    </div>`).join('');

  const barPct = Math.min(100, score);
  const barC = score < 20 ? '#1D9E75' : score < 45 ? '#BA7517' : score < 70 ? '#D85A30' : '#c94a4a';

  return `<div style="border:0.5px solid ${vc}55;border-radius:8px;padding:14px 14px 8px;margin-bottom:16px;background:${vbg};">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="font-size:10px;color:#888884;letter-spacing:0.08em;text-transform:uppercase;">Risk Assessment</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:10px;color:#888884;">Score: <span style="color:${vc};font-weight:500;">${score}</span>/100</span>
        <span style="background:${vbg};color:${vc};border:0.5px solid ${vc}55;border-radius:4px;padding:2px 10px;font-size:11px;font-weight:600;">${verdict}</span>
      </div>
    </div>
    <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:2px;margin-bottom:10px;">
      <div style="height:3px;width:${barPct}%;background:${barC};border-radius:2px;transition:width 0.3s;"></div>
    </div>
    ${flagRows}${stubRows}
  </div>`;
}
