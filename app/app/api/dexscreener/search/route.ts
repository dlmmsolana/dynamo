import { NextRequest, NextResponse } from 'next/server';
import type { DiscToken } from '../trending/route';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  if (!q) return NextResponse.json({ tokens: [] }, { status: 400 });

  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!r.ok) return NextResponse.json({ tokens: [] }, { status: 502 });

    const d = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pairs: any[] = (d.pairs || []).filter((p: any) => p.chainId === 'solana');

    const tokenMap: Record<string, DiscToken> = {};
    for (const p of pairs) {
      const addr: string = p.baseToken?.address;
      if (!addr) continue;
      if (!tokenMap[addr]) {
        tokenMap[addr] = {
          address: addr,
          chain: 'solana',
          name: p.baseToken?.name || '?',
          symbol: p.baseToken?.symbol || '?',
          price: parseFloat(p.priceUsd) || 0,
          mc: parseFloat(p.marketCap) || 0,
          priceChg: parseFloat(p.priceChange?.h24) || 0,
          priceH1: parseFloat(p.priceChange?.h1) || 0,
          priceH6: parseFloat(p.priceChange?.h6) || 0,
          tvl: 0, vol24: 0, volH1: 0, volH6: 0,
          pools: 0,
        };
      }
      tokenMap[addr].tvl   += parseFloat(p.liquidity?.usd || 0);
      tokenMap[addr].vol24 += parseFloat(p.volume?.h24 || 0);
      tokenMap[addr].volH1 += parseFloat(p.volume?.h1 || 0);
      tokenMap[addr].volH6 += parseFloat(p.volume?.h6 || 0);
      tokenMap[addr].pools++;
    }

    const tokens: DiscToken[] = Object.values(tokenMap)
      .filter((t) => t.mc > 0)
      .sort((a, b) => b.vol24 - a.vol24);

    return NextResponse.json({ tokens });
  } catch {
    return NextResponse.json({ tokens: [] }, { status: 500 });
  }
}
