import { fmt, fmtD } from './format';

export function buildMicroCapTable(mc: number, volLiq: number, tvl: number, ref: number): string {
  const dailyFees = ref * volLiq * 0.003;
  const refLbl = ref >= 1000 ? '$1K' : '$' + ref;
  const milestones = [
    { lbl: '$100K', tgt: 100000 },
    { lbl: '$250K', tgt: 250000 },
    { lbl: '$1M',   tgt: 1000000 },
  ];

  const rows = milestones.map(m => {
    const r = m.tgt / mc;
    const rStr = r >= 100 ? Math.round(r) + 'x' : r >= 10 ? r.toFixed(1) + 'x' : r.toFixed(2) + 'x';
    const spotVal = ref * r;
    const dammVal = ref * Math.sqrt(r);
    const ilDrag = spotVal - dammVal;
    const bedays = dailyFees > 0.001 ? Math.ceil(ilDrag / dailyFees) : null;
    const beStr = !bedays ? '—' : bedays > 365 ? '>1yr' : bedays + ' days';
    const beCl = !bedays ? '#555552' : bedays <= 30 ? '#1D9E75' : bedays <= 90 ? '#BA7517' : '#c94a4a';
    return `<tr>
      <td><strong style="color:#e8e8e6;">${m.lbl}</strong> <span style="font-size:9px;color:#555552;">${rStr}</span></td>
      <td style="color:#1D9E75;">${fmtD(spotVal)}</td>
      <td style="color:#378ADD;">${fmtD(dammVal)}</td>
      <td style="color:#c94a4a;">−${fmtD(ilDrag)}</td>
      <td style="color:${beCl};">${beStr}</td>
    </tr>`;
  }).join('');

  let rec: string, recC: string, recReason: string;
  const be100 = dailyFees > 0.001
    ? Math.ceil((ref * (100000 / mc) - ref * Math.sqrt(100000 / mc)) / dailyFees)
    : 9999;
  const volThreshold = Math.max(50, tvl * 0.03);

  if (mc < 1500 || volLiq < 0.005) {
    rec = 'Pass'; recC = '#c94a4a';
    recReason = `At ${fmt(mc)} MC with vol/liq ${volLiq.toFixed(3)}x there is effectively no liquid market. Any capital placed here has near-zero fee yield and maximum execution risk. Wait for price discovery and organic volume before deploying liquidity.`;
  } else if (volLiq >= 0.30) {
    rec = 'Wide DLMM + Spot'; recC = '#D85A30';
    recReason = `Vol/liq of ${volLiq.toFixed(2)}x is unusually high for Stage 0 — enough to justify a wide DLMM (Bid Ask, bin step 300–400). Allocate ~60% as wide DLMM for fee capture and ~40% as spot. Est. ${fmtD(dailyFees)}/day on ${refLbl}. Break-even vs spot at $100K: ${be100 < 9999 ? be100 + ' days' : '—'}.`;
  } else if (volLiq >= 0.10) {
    rec = 'Combination'; recC = '#7F77DD';
    recReason = `Vol/liq ${volLiq.toFixed(2)}x generates ${fmtD(dailyFees)}/day on ${refLbl}. Split ~50% DAMM (stability + passive fees) and ~50% spot (full upside). DAMM outperforms spot on downside; spot wins at high multiples. Break-even vs spot at $100K: ${be100 < 9999 ? be100 + ' days' : '—'}.`;
  } else if (volLiq >= 0.03) {
    rec = 'DAMM'; recC = '#1D9E75';
    recReason = `Vol/liq ${volLiq.toFixed(2)}x generates ${fmtD(dailyFees)}/day on ${refLbl}. DAMM is the right vehicle at Stage 0 — full-range, no rebalancing, earns fees at any price. IL drag is real (see table), but stability value outweighs the fee delta vs spot at this stage. Break-even vs spot at $100K: ${be100 < 9999 ? be100 + ' days' : '—'}.`;
  } else {
    rec = 'Spot only'; recC = '#BA7517';
    recReason = `Vol/liq is ${volLiq.toFixed(3)}x — below the 0.03x minimum for meaningful LP yield. Fees on ${refLbl}: ${fmtD(dailyFees)}/day — insufficient to justify IL risk. Take spot if you want exposure. Add DAMM only when daily volume sustainably exceeds ${fmtD(volThreshold)}.`;
  }

  return `
    <div style="font-size:10px;color:#555552;margin-bottom:10px;">vol/liq <strong style="color:#e8e8e6;">${volLiq.toFixed(2)}x</strong> · est. fees <strong style="color:#e8e8e6;">${fmtD(dailyFees)}/day</strong> on ${refLbl}</div>
    <div style="overflow-x:auto;margin-bottom:12px;">
      <table class="dtable" style="min-width:420px;">
        <thead><tr><th>MC target</th><th style="color:#1D9E75;">Spot (${refLbl})</th><th style="color:#378ADD;">DAMM (${refLbl})</th><th>IL drag</th><th>Fee break-even</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="font-size:10px;color:#333;margin-bottom:12px;">DAMM = ${refLbl} × √(price multiple). IL drag = Spot − DAMM. Break-even = days of fees at current vol/liq to offset IL. High multiples make spot structurally superior — DAMM is justified by stability value and downside protection.</div>
    <div style="padding:10px 12px;background:${recC}11;border:0.5px solid ${recC}33;border-radius:4px;display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;">
      <div style="flex-shrink:0;min-width:90px;">
        <div style="font-size:9px;color:#555552;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Recommendation</div>
        <div style="font-size:13px;font-weight:600;color:${recC};">${rec}</div>
      </div>
      <div style="font-size:11px;color:#888884;line-height:1.5;flex:1;">${recReason}</div>
    </div>`;
}

export function buildMicroCapSection(mc: number, volLiq: number, tvl: number): string {
  if (mc >= 40000) return '';
  const btnRow = [100, 250, 500, 1000].map(v => {
    const lbl = v >= 1000 ? '$1K' : '$' + v;
    const active = v === 1000;
    return `<button class="disc-btn${active ? ' primary' : ''}" style="padding:3px 10px;" onclick="window._dynamo && window._dynamo.setMicroCapRef(${v},this)">${lbl}</button>`;
  }).join('');

  return `
    <div class="sl">Micro-cap deployment analysis <span style="font-size:10px;font-weight:400;color:#555552;">MC &lt; $40K</span></div>
    <div style="border:0.5px solid rgba(255,255,255,0.08);border-radius:6px;background:#0f0f0f;padding:14px 16px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
        <span style="font-size:10px;color:#555552;letter-spacing:0.04em;">CAPITAL</span>
        <div style="display:flex;gap:5px;">${btnRow}</div>
        <span style="font-size:10px;color:#555552;margin-left:4px;">Current MC: <strong style="color:#e8e8e6;">${fmt(mc)}</strong></span>
      </div>
      <div id="micro-cap-table">${buildMicroCapTable(mc, volLiq, tvl, 1000)}</div>
    </div>`;
}
