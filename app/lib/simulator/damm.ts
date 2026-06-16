// DAMM v2 — full-range constant product (x·y = k) LP value projection.
// Position value scales with √price. With circulating supply constant,
// MC ratio == price ratio, so V_final = V0 · √(MC_final / MC0).
// Price appreciation only — no fees, no rebalancing.
//
// A full-range constant-product position is always 50/50 by value, so the
// starting LP value (in $) is all we need — no token/quote amounts required.

export interface DammInput {
  startValue: number;   // initial LP position value ($)
  entryMC: number;      // market cap at deposit
  targetMCs?: number[]; // optional override; defaults to DAMM_TARGET_MCS
}

export interface DammRow {
  mc: number;
  value: number;     // LP position value at this MC
  multiple: number;  // value / V0
  tokenSide: number; // $ on the token side (== value/2)
  quoteSide: number; // $ on the quote side (== value/2)
  vsHold: number;    // LP value − hold value (negative == impermanent loss vs holding)
  holdValue: number;
}

export interface DammResult {
  v0: number;       // initial LP value
  entryMC: number;
  rows: DammRow[];
}

// Fixed market-cap ladder simulated for every DAMM run.
export const DAMM_TARGET_MCS = [
  50_000, 100_000, 150_000, 250_000, 500_000,
  1_000_000, 2_500_000, 5_000_000, 10_000_000,
];

export function simulateDamm(input: DammInput): DammResult {
  const v0 = input.startValue;
  const entryMC = input.entryMC;
  const targets = input.targetMCs ?? DAMM_TARGET_MCS;

  const rows: DammRow[] = targets
    .filter((mc) => mc > 0 && entryMC > 0)
    .sort((a, b) => a - b)
    .map((mc) => {
      const ratio = mc / entryMC;
      const value = v0 * Math.sqrt(ratio);
      // Hold = original 50/50 split left untouched: token side scales with
      // the MC ratio, quote side stays flat.
      const holdValue = (v0 / 2) * ratio + (v0 / 2);
      return {
        mc,
        value,
        multiple: v0 > 0 ? value / v0 : 0,
        tokenSide: value / 2,
        quoteSide: value / 2,
        vsHold: value - holdValue,
        holdValue,
      };
    });

  return { v0, entryMC, rows };
}
