import { NextResponse } from 'next/server';

export interface DiscToken {
  address: string;
  name: string;
  symbol: string;
  price: number;
  mc: number;
  priceChg: number;
  priceH1: number;
  priceH6: number;
  tvl: number;
  vol24: number;
  volH1: number;
  volH6: number;
  pools: number;
}

export async function GET() {
  try {
    const r1 = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!r1.ok) return NextResponse.json({ tokens: [] }, { status: 502 });

    const raw = await r1.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boosts: any[] = (Array.isArray(raw) ? raw : []).filter((b: any) => b.chainId === 'solana');
    if (!boosts.length) return NextResponse.json({ tokens: [] });

    const addresses = [...new Set(boosts.map((b) => b.tokenAddress as string))].slice(0, 20);

    const r2 = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${addresses.join(',')}`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 30 } }
    );
    if (!r2.ok) return NextResponse.json({ tokens: [] }, { status: 502 });

    const d2 = await r2.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pairs: any[] = (d2.pairs || []).filter((p: any) => p.chainId === 'solana');

    const tokenMap: Record<string, DiscToken> = {};
    for (const p of pairs) {
      const addr: string = p.baseToken?.address;
      if (!addr) continue;
      const pVol = parseFloat(p.volume?.h24 || 0);
      if (!tokenMap[addr]) {
        tokenMap[addr] = {
          address: addr,
          name: p.baseToken?.name || '?',
          symbol: p.baseToken?.symbol || '?',
          price: parseFloat(p.priceUsd) || 0,
          mc: parseFloat(p.marketCap) || 0,
          priceChg: 0, priceH1: 0, priceH6: 0,
          tvl: 0, vol24: 0, volH1: 0, volH6: 0,
          pools: 0,
        };
      }
      tokenMap[addr].tvl   += parseFloat(p.liquidity?.usd || 0);
      tokenMap[addr].vol24 += pVol;
      tokenMap[addr].volH1 += parseFloat(p.volume?.h1 || 0);
      tokenMap[addr].volH6 += parseFloat(p.volume?.h6 || 0);
      tokenMap[addr].pools++;

      // highest-volume pair wins for price / price change fields
      const existing = tokenMap[addr];
      if (pVol > (existing as DiscToken & { _topVol?: number })._topVol! || !((existing as DiscToken & { _topVol?: number })._topVol)) {
        (existing as DiscToken & { _topVol?: number })._topVol = pVol;
        existing.price    = parseFloat(p.priceUsd) || existing.price;
        existing.priceChg = parseFloat(p.priceChange?.h24) || 0;
        existing.priceH1  = parseFloat(p.priceChange?.h1)  || 0;
        existing.priceH6  = parseFloat(p.priceChange?.h6)  || 0;
      }
    }

    const tokens: DiscToken[] = Object.values(tokenMap)
      .filter((t) => t.mc > 0)
      // strip internal _topVol field
      .map(({ ...t }) => t as DiscToken);

    return NextResponse.json({ tokens });
  } catch {
    return NextResponse.json({ tokens: [] }, { status: 500 });
  }
}
