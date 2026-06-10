import { fmt } from './format';
import { classifyStage, getShape, getRW, getBinConfig, getMig } from './classify';
import { detectPoolType } from './pools';

export interface AuditInput {
  name: string;
  symbol: string;
  mc: number;
  fdv: number;
  tvl: number;
  vol24: number;
  liqRatio: number;
  volLiq: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pairs: any[];
  priceChg: number;
  vola: string;
  stage: number;
}

export function auditAnalysis(inp: AuditInput, obj: string): string[] {
  const { name, symbol, mc, tvl, vol24, liqRatio, volLiq, pairs, priceChg, vola } = inp;
  const s = classifyStage(mc);
  const estFees = vol24 * 0.003;
  const fd = tvl > 0 ? estFees / tvl * 100 : 0;
  const dexes = [...new Set(pairs.map((p: any) => p.dexId))];
  const dlmmTVL = pairs.filter((p: any) => detectPoolType(p).type === 'DLMM').reduce((a: number, p: any) => a + parseFloat(p.liquidity?.usd || 0), 0);
  const dammTVL = pairs.filter((p: any) => detectPoolType(p).type === 'DAMM').reduce((a: number, p: any) => a + parseFloat(p.liquidity?.usd || 0), 0);
  const hasDamm = dammTVL > 100;
  const hasMeteora = dexes.some(d => (d as string).toLowerCase().includes('meteora'));
  const tvls = pairs.map((p: any) => parseFloat(p.liquidity?.usd || 0)).filter(v => v > 0);
  const tot = tvls.reduce((a, b) => a + b, 0) || 1;
  const fragScore = Math.min(100, Math.round(tvls.reduce((s, t) => s + Math.pow(t / tot * 100, 2), 0) / 100));
  const bestPoolTVL = pairs.reduce((mx: number, p: any) => Math.max(mx, parseFloat(p.liquidity?.usd || 0)), 0);

  if (obj === 'fee') {
    const viable = volLiq >= 0.5;
    const bc = getBinConfig(mc, 'fee');
    const rebalDays = vola === 'Low' ? '14–21' : vola === 'Medium' ? '5–10' : vola === 'High' ? '2–4' : '1–2';
    const projFee = Math.min(tvl, vol24 * 2) * 0.003 * 0.85;
    const p1 = viable
      ? `Fee density is currently <strong>${fd.toFixed(3)}%</strong> — ${fd >= 0.1 ? 'above the 0.1% viability threshold' : 'below the 0.1% daily minimum'}. At vol/liq of <strong>${volLiq.toFixed(2)}x</strong>, this token has ${fd >= 0.1 ? 'sufficient volume to justify tight concentration' : 'marginal volume — concentration will help, but volume needs to grow'}. A single Spot DLMM at <strong>${bc.desc}</strong> is estimated to yield <strong>${fmt(projFee)}/day</strong> (${fmt(projFee * 365)}/year at current volume). ${fd < 0.05 ? `Fee density is below the operational threshold — switch to a Balanced objective until vol/liq reaches 0.5x.` : ''}`
      : `<strong>Fee generation is not viable at current conditions.</strong> Vol/liq is <strong>${volLiq.toFixed(2)}x</strong> — below the 0.5x minimum. At ${fmt(estFees)}/day on ${fmt(tvl)} deployed, the fee density (${fd.toFixed(4)}%) does not cover the IL risk and ops cost of tight bin management. <strong>Switch to Balanced or Price Stability until daily volume reaches ${fmt(tvl * 0.5)}.</strong> Tight bins in a low-volume market go stale, not profitable.`;
    const p2 = pairs.length > 4
      ? `Fee generation is a concentration game, not a TVL game. ${fmt(tvl)} spread across ${pairs.length} pools has a fragmentation score of <strong>${fragScore}/100</strong> — every pool beyond the primary dilutes fee density. The fix: close all but the dominant DLMM and run a single <strong>Spot position · ${bc.desc}</strong> sized to volume demand (<strong>${fmt(vol24 * 1.5)}</strong> is the optimal TVL at current volume). One focused pool with the right depth outperforms ${pairs.length} diluted positions. Always.`
      : `Pool structure is acceptable — ${pairs.length} pool${pairs.length !== 1 ? 's' : ''}, fragmentation score <strong>${fragScore}/100</strong>. ${dlmmTVL > 0 ? `DLMM is ${(dlmmTVL / tvl * 100).toFixed(0)}% of TVL — ${dlmmTVL / tvl > 0.6 ? 'dominant and working' : 'should be higher for a fee objective; capital in DAMM earns 40–60% less than a well-positioned DLMM'}.` : '<strong>No DLMM detected.</strong> All capital is in full-range positions that earn a fraction of DLMM efficiency. A single Meteora DLMM Spot pool is the highest-leverage action available.'}`;
    const p3 = `Optimal config: <strong>${bc.desc}</strong>. Each bin covers ${(bc.step / 100).toFixed(2)}% of price — sized for this MC tier to balance fee density against rebalancing frequency. Full config: <strong>Spot distribution · ${getRW(vola, 'fee')} range · ${bc.desc}</strong>. At <strong>${vola.toLowerCase()}</strong> volatility, bins drift out of range every <strong>${rebalDays} days</strong> — calendar-block that rebalance cadence. Hold 15% of allocation as a float: deploy on each rebalance to reset range without adding new capital. Budget 20–30 min per cycle for the operational cost.`;
    const p4 = `Success: fee density above 0.1% daily, vol/liq sustaining above 0.5x for 7+ consecutive days. <strong>Invalidated if:</strong> (1) daily volume drops below ${fmt(tvl * 0.5)} for 3+ days — consolidate and wait; (2) price exits the ${getRW(vola, 'fee')} range — rebalance within 24h; (3) a new pool fragments the dominant position. Fee run rate: <strong>${fmt(estFees * 7)}/week · ${fmt(estFees * 365)}/year</strong>. Migration trigger: <strong>${getMig(s.stage)}</strong>.`;
    return [p1, p2, p3, p4];
  }

  if (obj === 'stability') {
    const dammTarget = mc * (s.stage <= 1 ? 0.10 : s.stage <= 2 ? 0.07 : 0.05);
    const dammDeficit = Math.max(0, dammTarget - dammTVL);
    const dlmmShape = vola === 'Low' ? 'Curve' : 'Bid Ask';
    const p1 = `Price stability has one non-negotiable foundation: <strong>a full-range DAMM backstop.</strong> ${hasDamm ? `${name} has ${fmt(dammTVL)} in DAMM — ${dammTVL >= dammTarget ? 'meeting the minimum requirement' : `below the ${fmt(dammTarget)} target. A ${fmt(dammDeficit)} DAMM addition is required before this structure provides genuine stability.`}` : `<strong>${name} has no DAMM position. This is the primary structural gap.</strong> A DAMM pool guarantees a bid at every price point — without it, a coordinated seller exhausts the DLMM range and faces zero bids. Deploy at least ${fmt(dammTarget)} into Meteora DAMM before any other action.`} The DAMM is not for yield — it earns stability. Explicitly de-prioritize fee density for this objective: a lower fee density in exchange for range permanence is the correct tradeoff.`;
    const p2 = `The reflexive loop works both directions: <strong>low liquidity → high price impact → volume avoidance → lower liquidity.</strong> Treasury-owned DAMM breaks this loop. Capital that cannot be withdrawn in a panic provides credible commitment that external LPs cannot. A ${fmt(dammTarget)} permanent DAMM backstop signals a price floor, attracts volume, builds fees, and funds more liquidity — the virtuous version of the same loop. ${liqRatio < 5 ? `The ${liqRatio.toFixed(1)}% liq ratio leaves ${name} exposed to reflexive downside. Increasing TVL to ${fmt(mc * 0.05)} is the most important action — not for yield, but to prevent the negative spiral before it starts.` : `The ${liqRatio.toFixed(1)}% liq ratio provides meaningful reflexive protection at this stage.`}`;
    const bcs = getBinConfig(mc, 'stability');
    const p3 = `DLMM configuration for stability: <strong>${dlmmShape} distribution · ${getRW(vola, 'stability')} range · ${bcs.desc}.</strong> Wide bins resist out-of-range drift — at ${(bcs.step / 100).toFixed(1)}% per bin, this DLMM at ${getRW(vola, 'stability')} survives most ${vola.toLowerCase()} volatility events without rebalancing. The ${dlmmShape} shape ${dlmmShape === 'Bid Ask' ? 'maintains symmetric two-sided depth that absorbs both buy and sell pressure, preventing one-directional cascades' : 'concentrates depth near current price with a gentle taper — persistent bid with downside coverage'}. ${pairs.length > 5 ? `Fragmentation (${pairs.length} pools, score ${fragScore}/100) is counterproductive for stability — consolidating to 2 positions (1 DAMM + 1 wide DLMM) concentrates defensive capital and improves floor integrity.` : 'Pool structure is acceptable for stability.'}`;
    const p4 = `Monitor in priority order: (1) <strong>DAMM TVL</strong> — target ${fmt(dammTarget)} minimum; if it drops, restore before anything else; (2) <strong>DLMM range</strong> — if price exits the ${getRW(vola, 'stability')} band, widen immediately, do not wait; (3) <strong>net buy/sell flow</strong> — consistent selling absorbed by the DLMM is the system functioning correctly; (4) <strong>large holder movements</strong> — early warning for coordinated selling. ${priceChg < -15 ? `<strong>Price is down ${Math.abs(priceChg).toFixed(0)}% in 24h — check DLMM range now.</strong> If bins are near the exit, widen to ${getRW('High', 'stability')} minimum immediately.` : ''} Migration trigger: <strong>${getMig(s.stage)}</strong>.`;
    return [p1, p2, p3, p4];
  }

  if (obj === 'volume') {
    const medianTrade = mc < 250000 ? 200 : mc < 1000000 ? 750 : mc < 5000000 ? 2500 : 7500;
    const depthNeeded = medianTrade * 100;
    const depthDeficit = Math.max(0, depthNeeded - bestPoolTVL);
    const routingScore = Math.min(100, Math.round((bestPoolTVL / (depthNeeded || 1)) * 60 + (hasMeteora ? 25 : 5) + (fragScore > 50 ? 15 : 0)));
    const p1 = `This is a routing game. Jupiter selects routes based on <strong>depth and slippage at the specific trade size</strong> — not total TVL, not pool count. For ${name} at ${fmt(mc)} MC, the typical trade size is ~$${medianTrade.toLocaleString()}. To achieve <0.5% slippage at that size, you need <strong>${fmt(depthNeeded)}</strong> in a single dominant pool. Largest pool today: <strong>${fmt(bestPoolTVL)}</strong>. ${bestPoolTVL >= depthNeeded ? `Depth is sufficient — this token is <strong>competitive for Jupiter routing</strong> at the median trade size.` : `<strong>Depth deficit of ${fmt(depthDeficit)}</strong> — ${symbol || name} is losing routes to better-structured tokens. Jupiter routes around thin pools.`}`;
    const p2 = `Fragmentation analysis: score <strong>${fragScore}/100</strong>. ${pairs.length > 3 ? `<strong>Fragmentation is the primary problem.</strong> ${pairs.length} pools competing for the same route means none dominates. Jupiter distributes flow, but thin pools get excluded above their slippage threshold. The correct move: close the ${pairs.length - 1} smaller pools and concentrate all capital into a single Meteora DLMM. One <strong>${fmt(tvl)}</strong> pool beats ${pairs.length} <strong>${fmt(tvl / pairs.length)}</strong> pools for routing — always. Fragmentation is costing you volume every day.` : `Pool structure is ${fragScore > 60 ? 'well-concentrated for routing' : 'borderline — consolidating further into the primary pool improves route scoring'}. ${fragScore <= 60 && pairs.length > 1 ? `Moving more TVL into the dominant pool improves Jupiter's route weighting for this token.` : 'Dominant pool position is competitive.'}`}`;
    const p3 = `DEX matters. At Stage ${s.stage}: <strong>${s.stage <= 3 ? 'Meteora DLMM is the optimal primary venue' : 'Meteora DLMM + Orca Whirlpool CLMM provide the best combined routing coverage'}</strong>. Meteora DLMM's active-bin concentration wins route scoring against passive CPMM at every trade size. ${hasMeteora ? `Meteora is in the pool mix — ${fragScore > 50 ? 'and with acceptable concentration. Routing position is competitive.' : 'but the Meteora DLMM needs to be the largest single pool.'}` : `<strong>No Meteora DLMM detected — significant routing disadvantage.</strong> A single concentrated Meteora DLMM Spot pool is the highest-impact action for volume growth.`} ${s.stage >= 3 && !dexes.some((d: any) => (d as string).toLowerCase().includes('orca') || (d as string).toLowerCase().includes('raydium')) ? `At Stage ${s.stage}, add Orca Whirlpool or Raydium CLMM as a secondary routing path for path diversity.` : ''}`;
    const p4 = `Routing dominance score: <strong>${routingScore}/100</strong>. ${routingScore >= 70 ? 'Competitive routing position.' : routingScore >= 40 ? 'Suboptimal — consolidation alone could lift this 20–30 points.' : 'Weak position — meaningful volume flow is going to better-structured competitors.'} Priority actions: (1) <strong>consolidate to 1 dominant Meteora DLMM</strong> targeting ${fmt(Math.max(depthNeeded * 1.5, tvl * 0.8))}; (2) <strong>Spot distribution · ${getBinConfig(mc, 'volume').desc} · depth at price > range width</strong>; (3) ${s.stage >= 3 ? 'add Orca CLMM secondary routing layer' : 'hold single-pool strategy until Stage 3'}. Volume won through routing compounds: more volume → better route scoring → more volume. Migration trigger: <strong>${getMig(s.stage)}</strong>.`;
    return [p1, p2, p3, p4];
  }

  // Balanced
  const dammShare = tvl > 0 ? (dammTVL / tvl * 100) : 0;
  const dammTarget = mc * 0.05;
  const dlmmYield = dlmmTVL * volLiq * 0.003;
  const stageMC = [50000, 250000, 1000000, 5000000, 20000000];
  const nextMC = stageMC[s.stage] || 0;
  const p1 = `Apply portfolio theory to this liquidity structure: <strong>DAMM = defensive allocation · DLMM = yield allocation · reserve = tactical allocation.</strong> Current breakdown: ${fmt(dammTVL)} in DAMM (${dammShare.toFixed(0)}%), ${fmt(dlmmTVL)} in DLMM (${tvl > 0 ? (dlmmTVL / tvl * 100).toFixed(0) : 0}%), remainder in other types. Stage ${s.stage} (${s.label}) target: <strong>${s.damm}% DAMM / ${s.dlmm}% DLMM${s.clmm > 0 ? ' / ' + s.clmm + '% CLMM' : ''}</strong>. ${Math.abs(dammShare - s.damm) > 15 ? `DAMM allocation is ${dammShare < s.damm ? 'underweight' : 'overweight'} by ${Math.abs(dammShare - s.damm).toFixed(0)}pp — rebalance toward target.` : 'Allocation is near stage target.'}`;
  const p2 = `<strong>Defensive allocation (DAMM):</strong> ${hasDamm ? `${fmt(dammTVL)} in DAMM provides the full-range price floor.` : '<strong>No DAMM detected — add this before increasing DLMM.</strong>'} DAMM is sized for resilience, not yield. Minimum target: <strong>${fmt(dammTarget)}</strong> — enough to absorb a significant sell event without catastrophic impact. ${dammTVL < dammTarget ? `DAMM is ${fmt(dammTarget - dammTVL)} short of minimum. Do not add more DLMM until DAMM is at target — the defensive allocation is the foundation everything else sits on.` : 'DAMM backstop is sufficient for current stage.'} Reducing DAMM to improve fee yield is explicitly not balanced.`;
  const p3 = `<strong>Yield allocation (DLMM):</strong> at vol/liq ${volLiq.toFixed(2)}x, the DLMM earns an estimated <strong>${fmt(dlmmYield)}/day</strong>. Config: <strong>${getShape(vola, 1.0, 'balanced')} distribution · ${getBinConfig(mc, 'balanced').desc} · ${getRW(vola, 'balanced')} range</strong> — deliberate middle ground between fee density and range permanence. ${volLiq < 0.3 ? 'Yield is minimal at current volume. That is acceptable here: the DLMM is structural now, yield-generating as volume grows.' : volLiq > 2 ? 'Vol/liq is strong — tightening bins slightly improves yield density without materially compromising coverage.' : 'Vol/liq is adequate for this configuration.'} ${pairs.length > 6 ? `Fragmentation (${pairs.length} pools, score ${fragScore}/100) is diluting yield — consolidate to 2–3 pools.` : ''}`;
  const p4 = `<strong>Tactical allocation (reserve — 20%):</strong> not idle — it is migration and emergency rebalancing capital. Next stage threshold: <strong>${fmt(nextMC)} MC</strong>${nextMC > mc ? ` (${fmt(nextMC - mc)} away)` : ' — approaching'}. Reserve activates at that transition: close the oldest DLMM first, deploy reserve into the Stage ${Math.min(s.stage + 1, 5)} structure, then close legacy positions. Do not deploy reserve into current-stage pools — its value is availability, not deployment. Migration trigger: <strong>${getMig(s.stage)}</strong>.`;
  return [p1, p2, p3, p4];
}
