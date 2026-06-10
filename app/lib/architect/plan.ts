import { fmt, fmtD } from '../auditor/format';
import {
  classifyStage, sc, getShape, getRW, getMig, getBinConfig, objConfig,
} from '../auditor/classify';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeployPlan {
  rows: string;
  estFees: number;
  shape: string;
  rw: string;
  dammAmt: number;
  dlmmAmt: number;
  clmmAmt: number;
  resAmt: number;
  damm: number;
  dlmm: number;
  clmm: number;
  reservePct: number;
}

export interface ArchInput {
  mc: number;
  fdv: number;
  capital: number;
  vol: number;
  vola: string;
  bsr: number;
  treasury: number;
  top10: number;
  holders: number;
  mc30: number;
  mc90: number;
}

// ── Deploy plan ───────────────────────────────────────────────────────────────

export function buildDeployPlan(
  capital: number,
  s: ReturnType<typeof classifyStage>,
  vola: string,
  bsr: number,
  mc: number,
  vol: number,
  obj: string
): DeployPlan {
  const cfg = objConfig(obj || 'balanced');
  let { damm, dlmm, clmm } = s;
  dlmm = Math.min(100, dlmm + cfg.dlmmBias);
  damm = Math.max(0, 100 - dlmm - clmm - cfg.reservePct);
  const rp = cfg.reservePct;

  const dammAmt = capital * damm / 100;
  const dlmmAmt = capital * dlmm / 100;
  const clmmAmt = capital * clmm / 100;
  const resAmt  = capital * rp  / 100;

  const shape   = getShape(vola, bsr, obj);
  const rw      = getRW(vola, obj);
  const estFees = (dlmmAmt + dammAmt) * 0.7 * (vol / (capital || 1)) * 0.003;
  const bc      = getBinConfig(mc, obj || 'balanced');

  let rows = '';
  if (damm > 0)
    rows += `<tr><td><span style="color:#1D9E75;font-weight:500;">DAMM Pool</span><div class="sub">Meteora Dynamic AMM · Full range</div></td><td><div class="amt">${fmtD(dammAmt)}</div><div class="sub">${damm}% of capital</div></td><td style="color:#888884;font-size:11px;">Full-range liquidity. No rebalancing needed. Captures upside automatically.</td><td style="color:#888884;font-size:11px;">Price 2× or 0.5× from launch</td></tr>`;
  if (dlmm > 0)
    rows += `<tr><td><span style="color:#378ADD;font-weight:500;">DLMM Pool</span><div class="sub">Meteora DLMM · ${shape} · ${rw}</div></td><td><div class="amt">${fmtD(dlmmAmt)}</div><div class="sub">${dlmm}% of capital</div></td><td style="color:#888884;font-size:11px;">${bc.desc}. ${cfg.rangeAdj}. Est. ${fmtD(estFees)}/day fees at current volume.</td><td style="color:#888884;font-size:11px;">${getMig(s.stage)}</td></tr>`;
  if (clmm > 0)
    rows += `<tr><td><span style="color:#D85A30;font-weight:500;">CLMM Pool</span><div class="sub">Orca Whirlpool or Raydium CLMM</div></td><td><div class="amt">${fmtD(clmmAmt)}</div><div class="sub">${clmm}% of capital</div></td><td style="color:#888884;font-size:11px;">Routing diversification. Captures institutional flow.</td><td style="color:#888884;font-size:11px;">When DLMM TVL exceeds ${fmtD(dlmmAmt * 2)}</td></tr>`;
  rows += `<tr><td><span style="color:#555552;font-weight:500;">Reserve</span><div class="sub">Treasury — do not deploy</div></td><td><div class="amt">${fmtD(resAmt)}</div><div class="sub">${rp}% of capital</div></td><td style="color:#888884;font-size:11px;">Migration fund. Deploy only at stage transitions.</td><td style="color:#888884;font-size:11px;">Next stage trigger</td></tr>`;

  return { rows, estFees, shape, rw, dammAmt, dlmmAmt, clmmAmt, resAmt, damm, dlmm, clmm, reservePct: rp };
}

// ── Migration roadmap ─────────────────────────────────────────────────────────

export function buildMigSteps(
  mc: number,
  mc30: number,
  mc90: number,
  mc180: number,
  capital: number,
  vola: string,
  bsr: number
): string {
  const milestones = [
    { mc: mc30, label: '30d target' },
    { mc: mc90, label: '90d target' },
    { mc: mc180, label: '180d target' },
  ].filter((m) => m.mc > mc);

  const colors = ['#1D9E75', '#378ADD', '#BA7517'];
  return milestones
    .map(({ mc: m, label }, i) => {
      const s  = classifyStage(m);
      const c  = colors[i] || '#555552';
      const sh = getShape(vola, bsr, 'balanced');
      const rw = getRW(vola, 'balanced');
      const cap = Math.min(capital * (m / mc) * 0.5, capital * 3);
      return `<div class="mstep">
        <div class="mstep-num" style="background:${c}22;color:${c};border:0.5px solid ${c}44;">${i + 1}</div>
        <div class="mstep-body">
          <div class="mstep-trigger">${label} · ${fmt(m)} MC · Stage ${s.stage}: ${s.label}</div>
          <div class="mstep-action">
            Trigger: <strong style="color:#e8e8e6;">${getMig(Math.max(0, s.stage - 1))}</strong><br>
            Action: Migrate to <strong style="color:#e8e8e6;">${s.damm}% DAMM / ${s.dlmm}% DLMM${s.clmm > 0 ? ' / ' + s.clmm + '% CLMM' : ''}</strong> · ${sh} · ${rw}<br>
            DLMM target TVL: <strong style="color:#e8e8e6;">${fmtD(cap * s.dlmm / 100)}</strong>
          </div>
        </div>
      </div>`;
    })
    .join('');
}

// ── Lifecycle capital plan ────────────────────────────────────────────────────

export function lifecycle(mc: number, vola: string, bsr: number, capital: number): string {
  const stages = [
    { l: 'Launch', m: mc },
    { l: '$50K', m: 50000 },
    { l: '$250K', m: 250000 },
    { l: '$1M', m: 1e6 },
    { l: '$5M', m: 5e6 },
    { l: '$10M', m: 1e7 },
  ];
  return stages
    .map(({ l, m }) => {
      const s   = classifyStage(m);
      const c   = sc(s.stage);
      const sh  = getShape(vola, bsr, 'balanced');
      const rw  = getRW(vola, 'balanced');
      const cap = Math.min(capital * (m / mc), capital * 20);
      return `<tr>
        <td>${l}</td>
        <td><span class="badge" style="background:${c}22;color:${c};border:0.5px solid ${c}44;">${s.label}</span></td>
        <td>${s.damm > 0 ? s.damm + '%' : '—'}<br><span style="font-size:10px;color:#555552;">${s.damm > 0 ? fmtD(cap * s.damm / 100) : ''}</span></td>
        <td>${s.dlmm > 0 ? s.dlmm + '%' : '—'}<br><span style="font-size:10px;color:#555552;">${s.dlmm > 0 ? fmtD(cap * s.dlmm / 100) : ''}</span></td>
        <td>${s.clmm > 0 ? s.clmm + '%' : '—'}<br><span style="font-size:10px;color:#555552;">${s.clmm > 0 ? fmtD(cap * s.clmm / 100) : ''}</span></td>
        <td>${s.dlmm > 0 ? sh : '—'}</td>
        <td>${s.dlmm > 0 ? rw : '—'}</td>
        <td style="color:#555552;font-size:10px;">${getMig(s.stage)}</td>
      </tr>`;
    })
    .join('');
}

// ── Written analysis ──────────────────────────────────────────────────────────

export function archAnalysis(inp: ArchInput, deploy: DeployPlan, obj: string): string[] {
  const { mc, fdv: _fdv, capital, vol, vola, bsr: _bsr, treasury, top10, holders, mc30, mc90 } = inp;
  const s   = classifyStage(mc);
  const lr  = capital / mc * 100;
  const vl  = vol / capital;

  if (obj === 'fee') {
    const rebalDays = vola === 'Low' ? '14–21' : vola === 'Medium' ? '5–10' : vola === 'High' ? '2–4' : '1–2';
    const bc     = getBinConfig(mc, 'fee');
    const viable = vl >= 0.5;
    const p1 = viable
      ? `At ${fmtD(vol)}/day against ${fmtD(capital)} deployed, the vol/liq ratio is <strong>${vl.toFixed(2)}x</strong> — ${vl >= 0.5 ? 'above the 0.5x threshold for viable fee generation' : 'below the minimum; launch with Balanced and switch to Fee Generation when vol exceeds ' + fmtD(capital * 0.5) + '/day'}. Fee yield projection: <strong>${fmtD(deploy.estFees)}/day</strong> (${fmtD(deploy.estFees * 365)}/year). Fee density on the DLMM allocation: ${deploy.dlmmAmt > 0 ? (deploy.estFees / deploy.dlmmAmt * 100).toFixed(3) : '0'}% — ${deploy.dlmmAmt > 0 && deploy.estFees / deploy.dlmmAmt * 100 >= 0.1 ? 'above the 0.1% viability floor' : 'building toward target as volume grows'}.`
      : `Vol/liq is <strong>${vl.toFixed(2)}x</strong> at the stated volume — below the 0.5x minimum for viable fee generation. Estimated daily yield: <strong>${fmtD(deploy.estFees)}</strong>. <strong>Consider launching with Balanced and switching to Fee Generation once volume establishes above ${fmtD(capital * 0.5)}/day.</strong> Tight bins into a low-volume market accumulate IL faster than they earn fees.`;
    const p2 = `The deployment puts <strong>${fmtD(deploy.dlmmAmt)} (${deploy.dlmm}%)</strong> into Meteora DLMM at <strong>Spot distribution · ${deploy.rw} · ${bc.desc}</strong> — maximum concentration within the stated volatility band. DAMM at ${fmtD(deploy.dammAmt)} is the minimum structural backstop: it protects against a catastrophic DLMM range exit but is deliberately underweighted in favour of fee density. The ${fmtD(deploy.resAmt)} reserve (${deploy.reservePct}%) is a <strong>rebalancing float, not idle capital</strong> — at ${vola.toLowerCase()} volatility, bins exit range every ${rebalDays} days, and each rebalance deploys a slice of reserve to reset range without adding new capital.`;
    const p3 = `Fee generation is an operational commitment. At <strong>${vola.toLowerCase()}</strong> volatility, plan a rebalancing event every <strong>${rebalDays} days</strong> — calendar-block it before launch. A missed rebalance costs ${fmtD(deploy.estFees * 4)}–${fmtD(deploy.estFees * 7)} in forgone fees (4–7 days idle). ${top10 > 40 ? `Top-10 concentration at ${top10}% accelerates bin exits — coordinated selling pushes price faster than normal volatility. Consider widening the range 20% from the stated ${deploy.rw} at launch.` : 'Holder concentration is acceptable for this strategy.'} Success: fee density consistently above 0.1% for 30+ days, vol/liq sustaining above 0.5x. If either metric drops, switch to Balanced before the reserve runs out.`;
    const p4 = `Fee generation compounds at each stage. At ${fmt(mc30)} (Stage ${classifyStage(mc30).stage}: ${classifyStage(mc30).label}), the DLMM allocation grows proportionally — fee yield scales with both TVL and any volume increase. At Stage 3+, introduce a CLMM layer on Orca for institutional-size trades: DLMMs win sub-$5K routes, CLMMs win larger. The objective stays fee generation throughout; only the instruments evolve. Migration trigger: <strong>${getMig(s.stage)}</strong>.`;
    return [p1, p2, p3, p4];
  }

  if (obj === 'stability') {
    const dammMin = mc * 0.08;
    const p1 = `Price stability is built at the capital structure level, not the DLMM level. This deployment puts <strong>${fmtD(deploy.dammAmt)} (${deploy.damm}%)</strong> into full-range Meteora DAMM — ${deploy.damm >= 40 ? 'a strong stability foundation that guarantees a bid at every price point' : 'below the 40% DAMM minimum for a Stage ' + s.stage + ' stability strategy; the structure is vulnerable to a zero-bid scenario if DLMM bins are exhausted'}. The ${lr.toFixed(1)}% liquidity-to-MC ratio at launch ${lr >= 8 ? 'provides meaningful reflexive protection from day one' : lr >= 4 ? 'is workable but thin — increase if possible before launch' : 'is critically thin for a stability objective; delay until liquidity reaches at least ' + fmtD(mc * 0.06)}.`;
    // dammMin is used conceptually above; reference it to satisfy linter
    void dammMin;
    const p2 = `The reflexive loop at launch: <strong>thin liquidity → high price impact → volume avoidance → lower price → panic selling</strong>. Treasury-owned DAMM breaks this loop because it cannot be withdrawn in a panic. ${fmtD(deploy.dammAmt)} in protocol-owned DAMM is worth more than ${fmtD(deploy.dammAmt * 2)} in external LP at Stage ${s.stage} — external LPs withdraw exactly when you need them most. ${treasury > 0 ? `The ${treasury}% treasury allocation should be routed into DAMM first: it is the highest-ROI use of treasury capital at this stage.` : 'Commit a portion of treasury reserves to permanent DAMM — this compounds stability faster than any other treasury deployment.'} Accept the lower fee yield (est. ${fmtD(deploy.estFees)}/day) as the cost of this insurance.`;
    const p3 = `DLMM configuration for stability: <strong>${deploy.shape} distribution · ${deploy.rw} range · ${getBinConfig(mc, 'stability').desc}</strong>. This intentionally sacrifices fee density for range permanence — wide bins at ${vola.toLowerCase()} volatility can survive without rebalancing for weeks. ${top10 > 50 ? `<strong>Top-10 concentration at ${top10}% is the critical risk.</strong> A coordinated sell event can exhaust even a wide range. Consider extending to ${vola === 'Low' ? '±45%' : vola === 'Medium' ? '±60%' : '±75%'} given this concentration level.` : top10 > 35 ? `Top-10 at ${top10}% warrants monitoring — the ${deploy.rw} range is the correct defense, but be ready to widen on any coordinated selling.` : 'Holder concentration is manageable.'} Do not tighten bins to improve fee yield — that trade-off is explicitly contrary to this objective.`;
    const p4 = `Hold the DAMM-heavy structure longer than instinct suggests. The common mistake is migrating DAMM to DLMM too early: at ${fmt(mc30)}, price may have moved significantly and the DAMM carries IL — that IL is the premium paid for stability. Begin reducing DAMM only at Stage ${Math.min(s.stage + 2, 5)} (${fmt([250000, 1000000, 5000000, 20000000, 20000000][s.stage] || 0)}+ MC) when price has established a clear range and manipulation risk is demonstrably lower. At every migration decision, ask: does the DAMM backstop still cover a 50% drawdown? If not, add before migrating. Migration trigger: <strong>${getMig(s.stage)}</strong>.`;
    return [p1, p2, p3, p4];
  }

  if (obj === 'volume') {
    const medianTrade  = mc < 250000 ? 200 : mc < 1000000 ? 750 : mc < 5000000 ? 2500 : 7500;
    const depthNeeded  = medianTrade * 100;
    const hasDepth     = deploy.dlmmAmt >= depthNeeded;
    const p1 = `Volume growth is a routing strategy. Jupiter routes to the pool with the best depth-to-slippage ratio for the specific trade size. At ${fmt(mc)} MC, the typical Jupiter trade is <strong>~$${medianTrade.toLocaleString()}</strong> — winning that route requires <strong>${fmt(depthNeeded)}</strong> in active depth at <0.5% slippage. This deployment puts ${fmtD(deploy.dlmmAmt)} into DLMM — ${hasDepth ? 'sufficient to compete for routing at launch' : 'a deficit of ' + fmt(depthNeeded - deploy.dlmmAmt) + '. At launch, this token will not win the Jupiter route at median trade size. If possible, increase deployable capital to ' + fmt(depthNeeded * 1.5) + ' before launch.'} The compounding effect: winning routing → more volume → higher route scoring → more routing.`;
    const p2 = `Concentrate into one pool. The Volume Growth objective is incompatible with spread deployment. A single Meteora DLMM at <strong>Spot distribution · ${deploy.rw} · ${getBinConfig(mc, 'volume').desc} · depth at price</strong> wins Jupiter routing. Two pools with ${fmtD(deploy.dlmmAmt / 2)} each lose to one competitor with ${fmtD(deploy.dlmmAmt * 0.8)} in a single position — Jupiter's smart router weights single-pool depth. The DAMM allocation (${fmtD(deploy.dammAmt)}) is a routing backstop, not a second venue. Keep both on Meteora to avoid splitting the routing signal across DEXs.`;
    const p3 = `DEX selection is a routing decision. At Stage ${s.stage}, <strong>Meteora DLMM is the launch venue</strong> — native Jupiter integration, active-bin concentration, and DLMM structure that dominates routing for sub-$5M tokens. ${s.stage >= 2 ? `At ${fmt(mc30)}, add an Orca Whirlpool CLMM as a secondary routing path. Jupiter diversifies routes at higher depth — two strong pools beat one at Stage ${classifyStage(mc30).stage}+.` : `Do not split across DEXs until Stage 2 minimum — routing diversity only helps when the primary pool is already dominant.`} Avoid CPMM and passive AMMs as primary deployment — neither wins route scoring against a well-positioned DLMM at this market cap.`;
    const p4 = `Volume compounds when routing is won: ${fmtD(vol)}/day at launch projects to ${fmtD(vol * 2.5)}/day at ${fmt(mc30)} if routing is established. That is ${fmtD(vol * 2.5 * 0.003)}/day in fees — ${fmtD(vol * 2.5 * 0.003 * 365)}/year. At Stage 3 (${fmt(1000000)} MC), begin adding CLMM for institutional trade sizes: DLMM wins sub-$2,500 routes, CLMM wins larger. The transition is additive — keep the DLMM until routing data confirms the CLMM is capturing flow. Migration trigger: <strong>${getMig(s.stage)}</strong>.`;
    return [p1, p2, p3, p4];
  }

  // Balanced — portfolio theory
  const risks: string[] = [];
  if (top10 > 50)      risks.push(`top-10 concentration at ${top10}% is the primary threat to price stability`);
  else if (top10 > 35) risks.push(`top-10 at ${top10}% warrants monitoring`);
  if (lr < 3)          risks.push('liquidity ratio is too thin — delay launch until more capital is available');
  if (holders < 150)   risks.push(`${holders} initial holders is fragile — a few exits can destabilize price`);
  if (vola === 'Extreme') risks.push('extreme volatility will push DLMM bins out of range rapidly — commit to weekly rebalancing');

  const p1 = `This token launches at ${fmt(mc)} market cap with ${fmtD(capital)} deployable — a <strong>${lr.toFixed(1)}% liquidity-to-MC ratio</strong>. ${lr < 3 ? `Critically thin. Increase to at least ${fmtD(mc * 0.05)} before launch.` : lr < 8 ? `Workable, but building volume before the ratio becomes a bottleneck is the first-30-days priority.` : `Strong starting position with enough depth for meaningful trade sizes.`} Stage ${s.stage} (${s.label}): ${s.stage <= 1 ? 'fair value is unknown — liquidity must stay permissive' : s.stage <= 2 ? 'price discovery is completing — DLMM concentration is appropriate now' : 'established range — fee efficiency is the primary lever'}.`;
  const p2 = `Portfolio theory applied: <strong>DAMM = defensive (${deploy.damm}%, ${fmtD(deploy.dammAmt)})</strong> · <strong>DLMM = yield (${deploy.dlmm}%, ${fmtD(deploy.dlmmAmt)})</strong> · <strong>reserve = tactical (${deploy.reservePct}%, ${fmtD(deploy.resAmt)})</strong>${deploy.clmm > 0 ? ' · CLMM = routing (' + deploy.clmm + '%, ' + fmtD(deploy.clmmAmt) + ')' : ''}. DAMM is sized for resilience — earns little, but guarantees a bid at every price. DLMM at <strong>${deploy.shape} · ${deploy.rw} · ${getBinConfig(mc, 'balanced').desc}</strong> earns est. <strong>${fmtD(deploy.estFees)}/day</strong>. Reserve is not deployed into current-stage pools — it activates only at the next migration trigger.`;
  const p3 = risks.length
    ? `Structural risks before launch: ${risks.join('; ')}. Size reserve conservatively and do not deploy it until a migration trigger fires. The most common mistake is reactive management — by the time price has exited bins, 3–5 days of fees are already lost.`
    : `Risk profile is manageable for a Balanced deployment. Resist over-optimizing for fee yield at the cost of structural stability — do not tighten bins until vol/liq consistently exceeds 0.5x for 7+ days.`;
  const p4 = `Migration targets ${fmt(mc30)} at 30 days and ${fmt(mc90)} at 90 days. Execute each migration deliberately: close underperforming DLMM positions first, deploy reserve into the new stage structure, then close legacy positions. At ${fmt(mc90)}, target structure is ${classifyStage(mc90).damm}% DAMM / ${classifyStage(mc90).dlmm}% DLMM${classifyStage(mc90).clmm > 0 ? ' / ' + classifyStage(mc90).clmm + '% CLMM' : ''} — begin planning before the trigger fires, not after. Migration trigger: <strong>${getMig(s.stage)}</strong>.`;
  return [p1, p2, p3, p4];
}
