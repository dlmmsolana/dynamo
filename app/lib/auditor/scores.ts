import { detectPoolType } from './pools';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function estSlippage(tradeSize: number, pairs: any[]): number {
  const best = pairs.reduce(
    (mx: any, p: any) =>
      parseFloat(p.liquidity?.usd || 0) > parseFloat(mx.liquidity?.usd || 0) ? p : mx,
    pairs[0],
  );
  const poolTVL = parseFloat(best?.liquidity?.usd || 0);
  if (!poolTVL) return 100;
  const pt = detectPoolType(best);
  const cf = pt.type === 'CLMM' ? 2.0 : pt.type === 'DLMM' ? 1.8 : pt.type === 'DAMM' ? 0.5 : 0.9;
  const oneSidedDepth = poolTVL * cf / 2;
  return Math.min(tradeSize / (oneSidedDepth + tradeSize) * 100, 99.9);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calcFragScore(pairs: any[]): number {
  const tvls = pairs.map(p => parseFloat(p.liquidity?.usd || 0)).filter(v => v > 0);
  if (!tvls.length) return 0;
  const total = tvls.reduce((a, b) => a + b, 0) || 1;
  const hhi = tvls.reduce((s, t) => s + Math.pow(t / total * 100, 2), 0);
  return Math.min(100, Math.round(hhi / 100));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calcRoutingScore(pairs: any[], tvl: number, mc: number): number {
  if (!pairs.length || !tvl) return 0;
  const medianTrade = mc < 250000 ? 200 : mc < 1000000 ? 750 : mc < 5000000 ? 2500 : 7500;
  const depthNeeded = medianTrade * 100;
  const bestPoolTVL = pairs.reduce(
    (mx: number, p: any) => Math.max(mx, parseFloat(p.liquidity?.usd || 0)),
    0,
  );
  const dr = bestPoolTVL / (depthNeeded || 1);
  const depthPts = dr >= 1 ? 40 : dr >= 0.5 ? 25 : dr >= 0.25 ? 10 : 0;
  const fragPts = Math.round(calcFragScore(pairs) * 0.30);
  const bestPool = pairs.reduce(
    (mx: any, p: any) =>
      parseFloat(p.liquidity?.usd || 0) > parseFloat(mx.liquidity?.usd || 0) ? p : mx,
    pairs[0],
  );
  const bestPT = detectPoolType(bestPool);
  const hasMDlmm = pairs.some(p => detectPoolType(p).group === 'Meteora DLMM');
  const venuePts =
    bestPT.group === 'Meteora DLMM' ? 30 :
    hasMDlmm ? 18 :
    (bestPT.type === 'DLMM' || bestPT.type === 'CLMM') ? 10 : 5;
  return Math.min(100, depthPts + fragPts + venuePts);
}
