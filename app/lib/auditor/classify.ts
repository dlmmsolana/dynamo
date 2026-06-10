export interface StageInfo {
  stage: number;
  label: string;
  damm: number;
  dlmm: number;
  clmm: number;
}

export interface ObjConfig {
  label: string;
  color: string;
  rangeAdj: string;
  reservePct: number;
  dlmmBias: number;
}

export interface BinConfig {
  step: number;
  fee: string;
  desc: string;
}

export function classifyStage(mc: number): StageInfo {
  if (mc < 50000)    return { stage: 0, label: 'Launch',       damm: 90, dlmm: 10, clmm: 0 };
  if (mc < 250000)   return { stage: 1, label: 'Discovery',    damm: 60, dlmm: 40, clmm: 0 };
  if (mc < 1000000)  return { stage: 2, label: 'Emerging',     damm: 25, dlmm: 75, clmm: 0 };
  if (mc < 5000000)  return { stage: 3, label: 'Growth',       damm:  5, dlmm: 90, clmm: 5 };
  if (mc < 20000000) return { stage: 4, label: 'Established',  damm:  0, dlmm: 70, clmm: 30 };
  return                    { stage: 5, label: 'Institutional', damm:  0, dlmm: 40, clmm: 60 };
}

export function sc(s: number): string {
  return ['#888780', '#1D9E75', '#378ADD', '#BA7517', '#D85A30', '#993556'][s] || '#888780';
}

export function getShape(vola: string, bsr: number, obj: string): string {
  if (vola === 'Extreme') return 'Multi Range';
  if (obj === 'stability') return bsr > 1.2 ? 'Curve' : 'Bid Ask';
  if (obj === 'fee') return vola === 'Low' ? 'Curve' : 'Spot';
  if (bsr > 1.4) return 'Skewed Bullish';
  if (bsr < 0.8) return 'Skewed Bearish';
  if (vola === 'High') return 'Bid Ask';
  if (vola === 'Low') return 'Curve';
  return 'Spot';
}

export function getRW(vola: string, obj: string): string {
  if (obj === 'stability') {
    return ({ Low: '±30%', Medium: '±40%', High: '±55%', Extreme: '±70%' }[vola] || '±40%');
  }
  const base: Record<string, number> = { Low: 5, Medium: 15, High: 35, Extreme: 60 };
  const b = base[vola] ?? 15;
  const adj = obj === 'fee' ? -3 : 0;
  return `±${Math.max(3, b + adj)}%`;
}

export function getMig(s: number): string {
  return [
    'MC > $50K or vol > $5K/day',
    'MC > $250K or 3x vol spike',
    'MC > $1M, bin utilization > 80%',
    'MC > $5M — introduce CLMM layer',
    'Route optimization, expand CLMM',
    'Full institutional market-making',
  ][s] || '—';
}

export function getTLP(s: number): string {
  return s <= 1 ? '40–60%' : s <= 3 ? '20–40%' : '5–20%';
}

export function objConfig(obj: string): ObjConfig {
  const map: Record<string, ObjConfig> = {
    fee:       { label: 'Fee Generation',  color: '#1D9E75', rangeAdj: 'Narrow range — max fee density',    reservePct: 15, dlmmBias: +10 },
    stability: { label: 'Price Stability', color: '#378ADD', rangeAdj: 'Wide range — persistent support',    reservePct: 25, dlmmBias: -10 },
    volume:    { label: 'Volume Growth',   color: '#BA7517', rangeAdj: 'Depth at price > range width',       reservePct: 20, dlmmBias: +5  },
    balanced:  { label: 'Balanced',        color: '#7F77DD', rangeAdj: 'Balanced width and concentration',  reservePct: 20, dlmmBias: 0   },
  };
  return map[obj] || map.balanced;
}

export function getBinConfig(mc: number, obj: string): BinConfig {
  const isMicro = mc < 500000;
  const isMid   = mc < 5000000;
  if (isMicro) {
    if (obj === 'fee')       return { step: 250, fee: '2%',    desc: 'Bin step 250 (2.5%/bin) · 2% fee tier'    };
    if (obj === 'stability') return { step: 400, fee: '4%',    desc: 'Bin step 400 (4%/bin) · 4% fee tier'      };
    if (obj === 'volume')    return { step: 300, fee: '3%',    desc: 'Bin step 300 (3%/bin) · 3% fee tier'      };
    return                          { step: 300, fee: '2.5%',  desc: 'Bin step 300 (3%/bin) · 2.5% fee tier'   };
  }
  if (isMid) {
    if (obj === 'fee')       return { step: 80,  fee: '0.5%',  desc: 'Bin step 80 (0.8%/bin) · 0.5% fee tier'  };
    if (obj === 'stability') return { step: 200, fee: '2%',    desc: 'Bin step 200 (2%/bin) · 2% fee tier'     };
    if (obj === 'volume')    return { step: 100, fee: '0.5%',  desc: 'Bin step 100 (1%/bin) · 0.5% fee tier'   };
    return                          { step: 150, fee: '1%',    desc: 'Bin step 150 (1.5%/bin) · 1% fee tier'   };
  }
  if (obj === 'fee')       return { step: 25,  fee: '0.25%', desc: 'Bin step 25 (0.25%/bin) · 0.25% fee tier' };
  if (obj === 'stability') return { step: 100, fee: '1%',    desc: 'Bin step 100 (1%/bin) · 1% fee tier'      };
  if (obj === 'volume')    return { step: 50,  fee: '0.25%', desc: 'Bin step 50 (0.5%/bin) · 0.25% fee tier'  };
  return                          { step: 80,  fee: '0.5%',  desc: 'Bin step 80 (0.8%/bin) · 0.5% fee tier'  };
}
