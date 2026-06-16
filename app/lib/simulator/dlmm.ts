// DLMM — discrete-bin (Meteora-style) concentrated liquidity value projection.
// Models a STATIC position: configurable bin step, distribution shape, and
// 1-sided / 2-sided structure. Price appreciation only — no fees, no rebalancing.
//
// Each bin trades as a constant-sum maker at its center price b_k, converting
// fully between base and quote as the active price crosses it.

export type Side = 'two' | 'dca-in' | 'dca-out';
export type Shape = 'spot' | 'curve' | 'bidask';

export interface Bin {
  price: number;      // center trading price b_k
  side: 'base' | 'quote'; // composition at entry
  base: number;       // base tokens held at entry (0 for quote bins)
  quote: number;      // quote held at entry (0 for base bins)
}

export interface DlmmInput {
  side: Side;
  shape: Shape;
  binStep: number;    // basis points
  low: number;        // range low price
  high: number;       // range high price
  entryPrice: number; // active price at deposit
  baseAmt: number;    // base tokens deposited
  quoteAmt: number;   // quote deposited
  entryMC?: number;   // optional — enables MC labeling (supply = entryMC/entryPrice)
  targets?: number[]; // optional extra target prices for the sweep
}

export interface SweepRow {
  price: number;
  mc: number | null;
  value: number;
  multiple: number;
  baseTokens: number; // base held at this price
  quoteHeld: number;  // quote held at this price
}

export interface DlmmResult {
  bins: Bin[];
  binCount: number;
  supply: number | null;
  depositValue: number; // base·entryPrice + quote
  entryValue: number;   // value(entryPrice) — sanity ≈ depositValue
  bottomValue: number;  // value(low)
  topValue: number;     // value(high)
  rows: SweepRow[];
}

const MAX_BINS = 2000; // guard against absurd range/binStep combos

// Geometric bins across [low, high]; each bin centered at b_k.
export function genBins(low: number, high: number, binStep: number): number[] {
  if (low <= 0 || high <= low || binStep <= 0) return [];
  const s = binStep / 10000;
  const n = Math.round(Math.log(high / low) / Math.log(1 + s));
  const count = Math.max(1, Math.min(n, MAX_BINS));
  const centers: number[] = [];
  for (let k = 0; k < count; k++) {
    centers.push(low * Math.pow(1 + s, k + 0.5));
  }
  return centers;
}

// Per-bin weight by shape. center is the pivot bin index; half is half-width.
export function shapeWeights(n: number, shape: Shape, center: number): number[] {
  if (n <= 0) return [];
  const half = Math.max(1, n / 2);
  const w: number[] = [];
  for (let k = 0; k < n; k++) {
    const d = Math.abs(k - center) / half; // 0 at center, →1 at edges
    let wk: number;
    if (shape === 'spot') wk = 1;
    else if (shape === 'curve') wk = Math.max(0.1, 1 - d);   // peak mid-range
    else wk = 0.1 + d;                                        // bidask: U-shape, peak at edges
    w.push(wk);
  }
  return w;
}

export function buildBins(input: DlmmInput): Bin[] {
  const { side, shape, binStep, low, high, entryPrice, baseAmt, quoteAmt } = input;
  const centers = genBins(low, high, binStep);
  if (!centers.length) return [];

  // Classify each bin's side relative to entry price.
  // base side = bins above entry (sold up); quote side = bins below entry (buys down).
  const sides: ('base' | 'quote')[] = centers.map((p) => {
    if (side === 'dca-out') return 'base';
    if (side === 'dca-in') return 'quote';
    return p >= entryPrice ? 'base' : 'quote';
  });

  // Shape pivot: entry bin index for two-sided; range midpoint for single-sided.
  let center: number;
  if (side === 'two') {
    let idx = centers.findIndex((p) => p >= entryPrice);
    if (idx < 0) idx = centers.length - 1;
    center = idx;
  } else {
    center = (centers.length - 1) / 2;
  }

  const weights = shapeWeights(centers.length, shape, center);

  const baseW = centers.reduce((sum, _p, k) => sum + (sides[k] === 'base' ? weights[k] : 0), 0);
  const quoteW = centers.reduce((sum, _p, k) => sum + (sides[k] === 'quote' ? weights[k] : 0), 0);

  return centers.map((price, k) => {
    if (sides[k] === 'base') {
      const base = baseW > 0 ? baseAmt * (weights[k] / baseW) : 0;
      return { price, side: 'base' as const, base, quote: 0 };
    }
    const quote = quoteW > 0 ? quoteAmt * (weights[k] / quoteW) : 0;
    return { price, side: 'quote' as const, base: 0, quote };
  });
}

// Position composition (token count + quote held) at a given active price.
export function compositionAtPrice(bins: Bin[], pf: number): { baseTokens: number; quoteHeld: number } {
  let baseTokens = 0;
  let quoteHeld = 0;
  for (const b of bins) {
    if (b.side === 'base') {
      // base bin: above pf → still base; pf crossed it (pf ≥ b.price) → sold to quote at b.price
      if (pf >= b.price) quoteHeld += b.base * b.price;
      else baseTokens += b.base;
    } else {
      // quote bin: pf below it (pf ≤ b.price) → bought base at b.price; else still quote
      if (pf <= b.price) baseTokens += b.quote / b.price;
      else quoteHeld += b.quote;
    }
  }
  return { baseTokens, quoteHeld };
}

export function valueAtPrice(bins: Bin[], pf: number): number {
  const { baseTokens, quoteHeld } = compositionAtPrice(bins, pf);
  return baseTokens * pf + quoteHeld;
}

export function simulateDlmm(input: DlmmInput): DlmmResult {
  const { low, high, entryPrice, baseAmt, quoteAmt, entryMC } = input;
  const bins = buildBins(input);

  const supply = entryMC && entryPrice > 0 ? entryMC / entryPrice : null;
  const mcOf = (p: number): number | null => (supply ? supply * p : null);
  const depositValue = baseAmt * entryPrice + quoteAmt;
  const entryValue = valueAtPrice(bins, entryPrice);

  // Sweep prices: range low → high, geometric steps, plus entry + any custom targets.
  const STEPS = 12;
  const sweepPrices = new Set<number>();
  if (low > 0 && high > low) {
    for (let i = 0; i <= STEPS; i++) {
      sweepPrices.add(low * Math.pow(high / low, i / STEPS));
    }
  }
  sweepPrices.add(entryPrice);
  (input.targets || []).forEach((t) => t > 0 && sweepPrices.add(t));

  const rows: SweepRow[] = [...sweepPrices]
    .sort((a, b) => a - b)
    .map((price) => {
      const { baseTokens, quoteHeld } = compositionAtPrice(bins, price);
      const value = baseTokens * price + quoteHeld;
      return {
        price,
        mc: mcOf(price),
        value,
        multiple: depositValue > 0 ? value / depositValue : 0,
        baseTokens,
        quoteHeld,
      };
    });

  return {
    bins,
    binCount: bins.length,
    supply,
    depositValue,
    entryValue,
    bottomValue: valueAtPrice(bins, low),
    topValue: valueAtPrice(bins, high),
    rows,
  };
}
