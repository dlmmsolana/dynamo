// DAMM v2 — full-range constant product (x·y = k) LP value projection.
// Position value scales with √price. With circulating supply constant,
// MC ratio == price ratio, so V_final = V0 · √(MC_final / MC0).
// Price appreciation only — no fees, no rebalancing.

export interface DammInput {
  tokenAmt: number;   // base tokens deposited
  quoteAmt: number;   // quote ($ USDC / SOL value) deposited
  entryMC: number;    // market cap at deposit
  targetMCs: number[]; // market caps to project to
}

export interface DammRow {
  mc: number;
  value: number;     // LP position value at this MC
  multiple: number;  // value / V0
  sideValue: number; // token side == quote side == value/2 (50/50 by value at any price)
  vsHold: number;    // LP value − hold value (negative == impermanent loss vs holding)
  holdValue: number;
}

export interface DammResult {
  v0: number;        // initial LP value
  entryPrice: number; // implied entry price = quote/token (balanced deposit)
  rows: DammRow[];
}

export function simulateDamm(input: DammInput): DammResult {
  const { tokenAmt, quoteAmt, entryMC } = input;

  // Balanced constant-product deposit: token value == quote value at entry.
  // Implied entry price P0 = quote / token; initial LP value V0 = token·P0 + quote = 2·quote.
  const entryPrice = tokenAmt > 0 ? quoteAmt / tokenAmt : 0;
  const v0 = tokenAmt * entryPrice + quoteAmt; // == 2·quoteAmt when balanced

  const rows: DammRow[] = input.targetMCs
    .filter((mc) => mc > 0 && entryMC > 0)
    .sort((a, b) => a - b)
    .map((mc) => {
      const ratio = mc / entryMC;
      const value = v0 * Math.sqrt(ratio);
      // Hold: same tokenAmt + quoteAmt, unprovided. token side scales with ratio.
      const holdValue = quoteAmt * ratio + quoteAmt; // quoteAmt·ratio (token side) + quoteAmt (quote side)
      return {
        mc,
        value,
        multiple: v0 > 0 ? value / v0 : 0,
        sideValue: value / 2,
        vsHold: value - holdValue,
        holdValue,
      };
    });

  return { v0, entryPrice, rows };
}
