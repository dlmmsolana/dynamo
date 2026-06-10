import { fmt, fmtD } from '../auditor/format';
import { classifyStage, getMig, getBinConfig, getRW } from '../auditor/classify';

export interface LPInputs {
  capital: number;
  risk: string;    // Conservative | Moderate | Aggressive
  horizon: string; // Days | Weeks | Months
  goal: string;    // Maximize PnL | Generate yield | Support the token | Speculate
}

export interface LPDecision {
  decision: string;
  decColor: string;
  rationale: string;
  config: Record<string, string> | null;
  outcomes: string[];
  risks: string[];
  watchList: string[];
}

export interface LPMetrics {
  name: string;
  symbol: string;
  price: number;
  mc: number;
  fdv: number;
  tvl: number;
  vol24: number;
  liqRatio: number;
  volLiq: number;
  priceChg: number;
  avgChg: number;
  vola: string;
  stage: ReturnType<typeof classifyStage>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function computeMetrics(pairs: any[]): LPMetrics {
  const ti   = pairs[0].baseToken || {};
  const price = parseFloat(pairs[0].priceUsd) || 0;
  const mc    = parseFloat(pairs[0].marketCap) || 0;
  const fdv   = parseFloat(pairs[0].fdv) || mc;
  let tvl = 0, vol24 = 0;
  pairs.forEach((p: any) => {
    tvl   += parseFloat(p.liquidity?.usd || 0);
    vol24 += parseFloat(p.volume?.h24 || 0);
  });
  const liqRatio = mc > 0 ? tvl / mc * 100 : 0;
  const volLiq   = tvl > 0 ? vol24 / tvl : 0;
  const priceChg = parseFloat(pairs[0]?.priceChange?.h24 || 0);
  const avgChg   = pairs.slice(0, 5).reduce((a: number, p: any) => a + Math.abs(parseFloat(p.priceChange?.h24 || 0)), 0) / Math.min(pairs.length, 5);
  const vola     = avgChg > 20 ? 'Extreme' : avgChg > 10 ? 'High' : avgChg > 5 ? 'Medium' : 'Low';
  return {
    name: ti.name || 'Unknown', symbol: ti.symbol || '?',
    price, mc, fdv, tvl, vol24, liqRatio, volLiq, priceChg, avgChg, vola,
    stage: classifyStage(mc),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function computeLPDecision(metrics: LPMetrics, inputs: LPInputs): LPDecision {
  const { name, mc, tvl, vol24, liqRatio, volLiq, priceChg, vola, stage: s } = metrics;
  const { capital, risk, horizon, goal } = inputs;

  let decision = '', decColor = '', rationale = '';
  let config: Record<string, string> | null = null;
  let outcomes: string[] = [], risks: string[] = [], watchList: string[] = [];

  // ── Universal blockers ──────────────────────────────────────────────────────
  if (vol24 === 0) {
    decision = 'No LP'; decColor = '#c94a4a';
    rationale = `Zero 24h volume on ${name}. LP positions earn fees only when trades route through them. Deploying capital here earns nothing regardless of configuration. Monitor for volume establishment over 3–5 consecutive days before reconsidering.`;
    risks = ['Token may be inactive, pre-launch, or delisted'];
    watchList = ['Daily volume — wait for >$500/day consistently before reconsidering'];
    return { decision, decColor, rationale, config, outcomes, risks, watchList };
  }

  if (vola === 'Extreme' && horizon === 'Days') {
    decision = 'No action'; decColor = '#888780';
    rationale = `${name} is in an extreme volatility regime (${metrics.avgChg.toFixed(0)}% avg 24h move). With a days horizon, DLMM bins will exit range within hours and DAMM will accumulate severe IL on sharp moves. Neither structure works for a short-hold in this regime. Wait for volatility to compress below 10% avg 24h before entering any LP position.`;
    risks = ['Any LP in extreme volatility at a short horizon will nearly always underperform spot or cash'];
    watchList = ['24h avg price change — enter when consistently below 10%', 'Watch for whether the spike is temporary or a new normal'];
    return { decision, decColor, rationale, config, outcomes, risks, watchList };
  }

  if (priceChg > 20 && (goal === 'Maximize PnL' || goal === 'Speculate')) {
    decision = 'Spot buy only'; decColor = '#BA7517';
    rationale = `Price is up ${priceChg.toFixed(0)}% in 24h — a strong directional move. LP creates IL drag in both directions: if price continues up, you underperform a spot hold; if it reverses, IL compounds the loss. With a ${goal.toLowerCase()} goal, spot exposure captures the full upside without range risk. ${fmt(capital)} in spot > ${fmt(capital)} in LP during a directional move. Enter LP only after price consolidates for 3+ days in a ±5% range.`;
    outcomes = [`Spot entry of ${fmt(capital)} captures full upside without IL drag`];
    risks = ['Reversal risk is elevated after a +20% day — size position accordingly', 'FOMO entry near a top is the most common LP mistake'];
    watchList = ['Price action — wait for consolidation before LP entry', 'Volume/price divergence as early reversal signal'];
    return { decision, decColor, rationale, config, outcomes, risks, watchList };
  }

  // ── Sub-$5K ─────────────────────────────────────────────────────────────────
  if (mc < 5000) {
    if (vol24 < 200) {
      decision = 'Pass'; decColor = '#888780';
      rationale = `${name} is below $5K MC with under $200/day in volume. At this capital depth, any LP position earns cents per day — the fee income does not justify the risk surface or the attention cost. This is pre-liquidity territory. If you believe in the token, hold spot and wait for volume to establish above $200/day before considering any LP structure.`;
      risks = ['Sub-$5K tokens have extremely high failure rates — position sizing should reflect that', 'Price impact on any entry or exit will be significant at this liquidity depth'];
      watchList = ['Daily volume — re-evaluate above $200/day', 'MC growth toward the $5K–$40K range where DAMM becomes viable'];
    } else {
      decision = 'DAMM + Spot'; decColor = '#1D9E75';
      const dammAmt = capital * 0.6, spotAmt = capital * 0.4;
      const dammFee = dammAmt * volLiq * 0.003;
      config = { pool: 'Meteora Dynamic AMM (DAMM)', dammSize: fmt(dammAmt) + ' — 60%', spotHold: fmt(spotAmt) + ' — 40%, hold token (not LP)', range: 'Full range — active at any price', rebalancing: 'None required' };
      rationale = `At sub-$5K MC, ${name} is at the earliest stage of price discovery. A DAMM pool here can compound remarkably well: as MC grows toward $40K, $100K, or beyond, DAMM TVL grows with it — earning fees at every price point along the way with no bins to exit and no rebalancing required. ${fmt(dammAmt)} in DAMM establishes a real bid floor and earns on every trade. The remaining ${fmt(spotAmt)} stays as spot — clean directional exposure with zero rebalancing pressure. No DLMM at this stage: bins exit range on the first 15–20% move, which is routine at sub-$5K MC, and the rebalancing cost exceeds the fee income.`;
      outcomes = [`DAMM fees: ~${fmt(dammFee)}/day at current volume`, 'Spot: full upside capture, no IL from range exits', 'DAMM TVL compounds with price — growing MC grows the position value automatically'];
      risks = ['Sub-$5K tokens have extremely high failure rates — only deploy what you can lose entirely', 'Your entry creates meaningful price impact at this liquidity depth', 'DAMM IL is real: significant token depreciation means LP underperforms a pure spot hold'];
      watchList = ['Daily volume — sub-$100/day means DAMM fees are negligible', 'MC toward $40K: trigger to reassess structure and consider adding a DLMM layer', 'Rug signals: check mint authority, LP concentration, wallet count on Solscan'];
    }
    return { decision, decColor, rationale, config, outcomes, risks, watchList };
  }

  // ── $5K–$40K ────────────────────────────────────────────────────────────────
  if (mc < 40000) {
    if (volLiq >= 0.5) {
      decision = 'DAMM'; decColor = '#1D9E75';
      const dammFee = capital * volLiq * 0.003;
      config = { pool: 'Meteora Dynamic AMM (DAMM)', size: fmt(capital), range: 'Full range — no manual management', rebalancing: 'None — DAMM adjusts automatically' };
      rationale = `At ${fmt(mc)} MC, vol/liq at ${volLiq.toFixed(2)}x is strong enough to make full DAMM worthwhile. Tokens in the $5K–$40K range move 15–30% on a normal day — DLMM bins exit range on the first strong move and sit idle until rebalanced, costing you both fees and attention. DAMM stays active at any price, earns on every trade, and captures full upside if ${name} compounds. ${fmt(capital)} fully in DAMM is the right structure: do not dilute it with a DLMM allocation you will have to chase constantly at this MC.`;
      outcomes = [`Est. yield: ~${fmt(dammFee)}/day (${fmt(dammFee * 365)}/yr at current volume)`, 'IL spread across the full range — far lower severity than a DLMM that exits range', 'Rebalancing: none — zero operational overhead'];
      risks = ['Micro-cap tokens have high failure risk — size to what you can afford to lose', ...(liqRatio < 3 ? ['Thin overall liquidity: your position has significant price impact on entry/exit'] : []), 'DAMM IL compounds if price falls significantly and stays down'];
      watchList = [`MC toward $40K: trigger to add a DLMM layer alongside DAMM`, `Vol/liq — if it drops below 0.3x, fees thin out; reconsider sizing`, `Migration trigger: ${getMig(s.stage)}`];
    } else if (volLiq >= 0.1) {
      decision = 'DAMM + Spot'; decColor = '#1D9E75';
      const dammAmt = capital * 0.5, spotAmt = capital * 0.5;
      const dammFee = dammAmt * volLiq * 0.003;
      config = { pool: 'Meteora Dynamic AMM (DAMM)', dammSize: fmt(dammAmt) + ' — 50%', spotHold: fmt(spotAmt) + ' — 50%, hold token (not LP)', range: 'Full range', rebalancing: 'None required' };
      rationale = `Vol/liq at ${volLiq.toFixed(2)}x at ${fmt(mc)} MC is workable but not strong enough to justify full DAMM deployment. A 50/50 split makes the most of current conditions: the DAMM half earns fees on every trade and maintains a bid at every price point; the spot half holds clean directional upside with no rebalancing pressure. If volume grows and vol/liq passes 0.5x, shift the spot allocation into DAMM. If volume stays flat, the spot position costs you nothing operationally.`;
      outcomes = [`DAMM fees: ~${fmt(dammFee)}/day at current volume`, 'Spot: full upside on 50% of capital — no range risk or management overhead', 'If MC doubles: both positions benefit — DAMM TVL grows with price, spot appreciates'];
      risks = ['Volume may not grow — monitor trend over 7–14 days before committing more to DAMM', 'Micro-cap failure risk: never more than you can lose entirely', 'Thin liquidity means entry/exit has meaningful price impact'];
      watchList = ['Vol/liq trend — target 0.5x+ before shifting more capital to DAMM', 'Daily volume absolute level — is it growing week-over-week?', `MC toward $40K: time to reassess full structure`];
    } else {
      decision = 'Spot only'; decColor = '#BA7517';
      const dailyFee = capital * volLiq * 0.003;
      rationale = `Vol/liq at ${volLiq.toFixed(2)}x at ${fmt(mc)} MC generates ~${fmt(dailyFee)}/day on ${fmt(capital)} deployed. That does not compensate for IL exposure, the operational overhead, or the rug risk at this stage. Hold ${fmt(capital)} as spot: full directional upside with no position to manage, no range to monitor, and no LP-specific loss vectors. Re-evaluate LP when daily volume consistently exceeds ${fmt(tvl * 0.1)} and vol/liq is trending toward 0.1x+.`;
      outcomes = [`Spot: ${fmt(capital)} in token, full upside, zero LP overhead`];
      risks = ['LP at this vol/liq earns less than $1/day per $1K deployed — not worth the risk surface', 'Micro-cap failure risk applies to spot too — size accordingly'];
      watchList = [`Daily volume — target >${fmt(tvl * 0.1)}/day before reconsidering LP`, `Vol/liq — wait for trend toward 0.1x+`, 'Unique holders growing: sign of organic demand building'];
    }
    return { decision, decColor, rationale, config, outcomes, risks, watchList };
  }

  // ── $40K–$150K ───────────────────────────────────────────────────────────────
  if (mc < 150000) {
    decision = 'Wide DLMM + Spot Hedge'; decColor = '#378ADD';
    const dlmmAmt = capital * 0.65, spotAmt = capital * 0.35;
    const estFee = dlmmAmt * volLiq * 0.003 * 0.7;
    const rw = (vola === 'High' || vola === 'Extreme') ? '±35%' : '±30%';
    config = { pool: 'Meteora DLMM', dlmmSize: fmt(dlmmAmt) + ' — 65%', spotHold: fmt(spotAmt) + ' — 35%, hold token (not LP)', distribution: 'Bid Ask', binStep: 'Bin step 300–400 · wide two-sided depth', range: rw, rebalancing: 'Monitor weekly — rebalance if price exits range' };
    rationale = `At ${fmt(mc)} MC, price range is starting to establish but volatility is still high enough to blow through tight bins. DAMM alone under-earns at this stage — vol/liq at ${volLiq.toFixed(2)}x is viable enough for some concentration. Wide Bid Ask DLMM at bin step 300–400 provides two-sided depth that survives typical 20–30% moves without exiting; the wide bins mean you do not need to rebalance after every swing. The 35% spot hedge is the key differentiator: if ${name} runs 50–100% from here, the spot portion captures the full move while the DLMM earns fees without any rebalancing pressure. Tight DLMM fails here — it exits range on the first strong move and sits idle exactly when the token is most active.`;
    outcomes = [`DLMM fees: ~${fmt(estFee)}/day at current volume`, 'Spot: full upside on 35% of capital — no range risk, no IL', `Bid Ask at ${rw} with bin step 300–400: survives most normal volatility without rebalancing`];
    risks = [`DLMM exits range if price moves beyond ${rw} — extreme moves can still push it out`, 'Spot portion has no downside protection — it falls with the token price', ...(volLiq < 0.3 ? [`Vol/liq at ${volLiq.toFixed(2)}x is thin — fees may not justify the DLMM allocation`] : [])];
    watchList = [`Price vs ${rw} range — rebalance the DLMM immediately if exiting`, `Vol/liq trend — if declining, widen range or shift more to spot`, `MC toward $150K: consider adding a DAMM backstop at that point`];
    return { decision, decColor, rationale, config, outcomes, risks, watchList };
  }

  // ── $150K–$500K ──────────────────────────────────────────────────────────────
  if (mc < 500000) {
    const rangebound = Math.abs(priceChg) <= 15 && (vola === 'Low' || vola === 'Medium');
    if (rangebound) {
      decision = 'Medium DLMM'; decColor = '#378ADD';
      const shape = vola === 'Low' ? 'Curve' : 'Spot';
      const rw = vola === 'Low' ? '±15%' : '±20%';
      const estFee = capital * volLiq * 0.003 * 0.65;
      config = { pool: 'Meteora DLMM', size: fmt(capital), distribution: shape, binStep: 'Bin step 80–150 · medium concentration', range: rw, rebalancing: 'Monitor twice weekly — rebalance if price exits range' };
      rationale = `At ${fmt(mc)} MC with price ${priceChg >= 0 ? '+' : ''}${priceChg.toFixed(1)}% in 24h and ${vola.toLowerCase()} volatility, ${name} is range-bound — consolidating rather than trending. This is the condition where DLMM concentration earns well without constant rebalancing. A ${shape} distribution at bin step 80–150 puts capital where trades are happening without overexposing to IL from a directional move. The ${rw} range captures normal daily volatility at this MC cleanly. ${fmt(capital)} into a single DLMM pool — no split needed while price is stable. If price breaks out of the ${rw} range, switch to Bid Ask immediately and widen to ±30–40%.`;
      outcomes = [`Est. yield: ~${fmt(estFee)}/day at current volume`, `${shape} distribution: ${vola === 'Low' ? 'deep midpoint concentration for stable price' : 'centered depth for fee maximization'}`, `${rw} range covers normal ${vola.toLowerCase()} volatility without rebalancing`];
      risks = [`Exits range on moves beyond ${rw} — rebalance trigger`, `Volatility shift to High invalidates this setup — widen to Bid Ask ±30–40% immediately`, ...(volLiq < 0.3 ? [`Vol/liq at ${volLiq.toFixed(2)}x is thin — fees may not justify active DLMM management`] : [])];
      watchList = [`Price approaching ±${vola === 'Low' ? '12' : '16'}% from entry — early rebalance warning`, 'Volatility regime shift to High: trigger to move to Wide DLMM (Bid Ask ±30–40%)', 'Vol/liq trend — growing volume multiplies fee capture at this concentration'];
    } else {
      decision = 'Wide DLMM'; decColor = '#378ADD';
      const rw = vola === 'Extreme' ? '±40%' : '±35%';
      const estFee = capital * volLiq * 0.003 * 0.45;
      config = { pool: 'Meteora DLMM', size: fmt(capital), distribution: 'Bid Ask', binStep: 'Bin step 200–300 · wide two-sided depth', range: rw, rebalancing: 'Monitor weekly — rebalance if price exits range' };
      rationale = `At ${fmt(mc)} MC with ${vola.toLowerCase()} volatility${Math.abs(priceChg) > 15 ? ` and price ${priceChg >= 0 ? '+' : ''}${priceChg.toFixed(1)}% in 24h — actively trending` : ''}, medium DLMM bins would exit range on the next directional move and sit idle while the token is most active. Wide Bid Ask at bin step 200–300 provides symmetric two-sided depth that absorbs both buy and sell pressure and survives typical ${vola.toLowerCase()} volatility without rebalancing. The wide bins reduce fee density vs a tighter setup — that is the deliberate trade-off: durability over yield. ${fmt(capital)} into a single Bid Ask DLMM pool. When price stabilizes and volatility compresses to Low or Medium, tighten to Spot or Curve at bin step 80–150 to improve fee capture.`;
      outcomes = [`Est. yield: ~${fmt(estFee)}/day at current volume`, 'Bid Ask: symmetric depth absorbs directional moves in both directions', `${rw} range survives most ${vola.toLowerCase()} volatility events without rebalancing`];
      risks = [`Still exits range on moves beyond ${rw} — extreme events can push it out`, 'Lower fee density than medium DLMM — deliberate trade-off for range durability', ...(volLiq < 0.3 ? [`Vol/liq at ${volLiq.toFixed(2)}x is thin — fees will be minimal at any bin configuration`] : [])];
      watchList = [`Price approaching ±${vola === 'Extreme' ? '35' : '28'}% from entry — rebalance warning`, 'Volatility compressing to Low/Medium: tighten to Spot or Curve bin step 80–150', 'Vol/liq growing: tightening the range multiplies fee capture significantly'];
    }
    return { decision, decColor, rationale, config, outcomes, risks, watchList };
  }

  // ── $500K+ ───────────────────────────────────────────────────────────────────
  if (volLiq < 0.5 && goal === 'Generate yield') {
    decision = 'No LP'; decColor = '#c94a4a';
    const dailyEst = capital * volLiq * 0.003;
    rationale = `Fee generation is not viable at vol/liq ${volLiq.toFixed(2)}x — below the 0.5x minimum. A ${fmt(capital)} position earns ~${fmt(dailyEst)}/day at current volume. That does not compensate for IL exposure and the operational overhead of active management. Switch goal to "Support the token" if you want protocol exposure, or wait until daily volume reaches ${fmt(tvl * 0.5)}.`;
    risks = [`${fmt(dailyEst)}/day yield does not justify IL risk at current volume`];
    watchList = [`Daily volume — target >${fmt(tvl * 0.5)}/day before yield-focused LP`, 'Vol/liq — watch for trend toward 0.5x+'];
    return { decision, decColor, rationale, config, outcomes, risks, watchList };
  }

  if ((s.stage <= 1 || risk === 'Conservative' || goal === 'Support the token') && !(risk === 'Aggressive' && volLiq >= 1.5)) {
    decision = 'DAMM / Full-range AMM'; decColor = '#1D9E75';
    const dammFee = capital * volLiq * 0.003 * 0.3;
    config = { pool: 'Meteora Dynamic AMM (DAMM)', size: fmt(capital), range: 'Full range — no manual management required', rebalancing: 'None — DAMM adjusts automatically at any price' };
    rationale = `${s.stage <= 1 ? `At Stage ${s.stage} (${s.label}), fair value is not established — price could 10x or 0.1x from here. ` : ''}${risk === 'Conservative' ? 'A conservative approach avoids range risk entirely. ' : ''}${goal === 'Support the token' ? 'Supporting the token means permanent bid presence at every price point — only DAMM delivers that. ' : ''}A full-range DAMM captures the full upside if the token breaks out, earns fees continuously at any price, and never goes "out of range." It earns lower fees than a concentrated DLMM, but the capital is always active.`;
    outcomes = [`Est. yield: ~${fmt(dammFee)}/day (lower than DLMM but always earning)`, 'IL: present but lower severity than range positions', 'Rebalancing: none — zero operational overhead'];
    risks = [...(s.stage <= 1 ? ['Stage 0–1 tokens have high failure risk — size to what you can afford to lose'] : []), ...(liqRatio < 3 ? ['Thin overall liquidity — your entry/exit has meaningful price impact'] : []), 'IL is real: significant token depreciation means LP underperforms hold'];
    watchList = [`Migration trigger: ${getMig(s.stage)}`, "DAMM TVL — verify protocol hasn't migrated the pool", 'Price appreciation — DAMM captures it automatically, no action needed'];
    return { decision, decColor, rationale, config, outcomes, risks, watchList };
  }

  if (volLiq >= 1.5 && risk === 'Aggressive' && vola !== 'Extreme' && horizon !== 'Days') {
    decision = 'Tight DLMM'; decColor = '#D85A30';
    const bc = getBinConfig(mc, 'fee');
    const rw = vola === 'High' ? '±8%' : vola === 'Medium' ? '±5%' : '±3%';
    const rebalDays = vola === 'High' ? '2–4' : vola === 'Medium' ? '4–7' : '7–14';
    const estFee = capital * volLiq * 0.003 * 0.8;
    config = { pool: 'Meteora DLMM', size: fmt(capital), distribution: 'Spot', binStep: bc.desc, range: rw, rebalancing: `Every ${rebalDays} days at ${vola.toLowerCase()} volatility` };
    rationale = `At vol/liq ${volLiq.toFixed(2)}x, this token has the volume density to make tight concentration profitable. A Spot DLMM at <strong>${bc.desc}</strong> puts capital exactly where trades happen, maximizing fee capture per dollar deployed. At ${vola.toLowerCase()} volatility, expect bins to stay active for ~${rebalDays} days before rebalancing. This is an active strategy — account for the management time before committing capital.`;
    outcomes = [`Est. yield: ~${fmt(estFee)}/day (${fmt(estFee * 365)}/yr at current volume)`, 'IL: moderate–high — tight range amplifies IL on sharp moves', `Break-even volume: ~${fmt(capital * 0.01 / 0.003)}/day to justify operational costs`];
    risks = [`Bins exit range every ${rebalDays} days — missed rebalance = dead bins earning nothing`, 'Tight range amplifies IL significantly on any sharp move', ...(volLiq < 2 ? ['Vol/liq is borderline — monitor weekly and widen if it drops'] : [])];
    watchList = ['Bin utilization — rebalance immediately when price exits range', 'Vol/liq ratio — widen or exit if it drops below 0.5x', 'Volume consistency — one outlier day does not justify tight bins long-term'];
    return { decision, decColor, rationale, config, outcomes, risks, watchList };
  }

  // Default: Wide DLMM
  {
    decision = 'Wide DLMM'; decColor = '#378ADD';
    const bc = getBinConfig(mc, 'balanced');
    const rw = getRW(vola, 'balanced');
    const estFee = capital * volLiq * 0.003 * 0.5;
    const shape = vola === 'Low' ? 'Curve' : vola === 'High' || vola === 'Extreme' ? 'Bid Ask' : 'Spot';
    config = { pool: 'Meteora DLMM', size: fmt(capital), distribution: shape, binStep: bc.desc, range: rw, rebalancing: 'Monitor weekly — rebalance if price exits range' };
    rationale = `A wide DLMM is the right call for ${name} at ${risk.toLowerCase()} risk with a ${horizon.toLowerCase()} horizon. The ${shape} distribution at <strong>${bc.desc}</strong> provides enough range depth to survive typical ${vola.toLowerCase()} volatility without constant management, while earning meaningfully better fees than full-range DAMM. Not a set-and-forget position — plan a weekly bin utilization check.`;
    outcomes = [`Est. yield: ~${fmt(estFee)}/day (${fmt(estFee * 365)}/yr at current volume)`, 'IL: moderate — wide range limits IL vs tight DLMM', ...(estFee > 0 ? [`Break-even: ~${Math.round(capital * 0.005 / Math.max(estFee, 0.01))} days of fees to recover typical entry/exit costs`] : [])];
    risks = [...((vola === 'High' || vola === 'Extreme') ? [`${vola} volatility may still push price outside the ${rw} range`] : []), ...(liqRatio < 3 ? ['Thin overall liquidity — meaningful price impact on entry/exit'] : []), `Vol/liq ${volLiq.toFixed(2)}x — ${volLiq < 0.5 ? 'borderline; fees may not justify IL risk' : 'adequate for this configuration'}`];
    watchList = ['Price vs active range — rebalance if exiting', `Weekly vol/liq — if declining, widen or shift to DAMM`, `Migration trigger: ${getMig(s.stage)}`];
    return { decision, decColor, rationale, config, outcomes, risks, watchList };
  }
}
