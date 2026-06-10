import { detectPoolType } from './pools';

const METEORA_AMM_PROGRAM = 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB';
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

async function solRpc(method: string, params: unknown[]): Promise<unknown> {
  const r = await fetch(SOLANA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (r.status === 429) throw new Error('Rate limited — try again shortly');
  if (!r.ok) throw new Error(`RPC HTTP ${r.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.result;
}

function sh(a: string): string {
  return a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '?';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadLPOwnershipSection(pairs: any[]): Promise<string> {
  const hasPumpSwap   = pairs.some(p => detectPoolType(p).group === 'PumpSwap');
  const dammPools     = pairs.filter(p => detectPoolType(p).group === 'Meteora DAMM');
  const hasOtherTypes = pairs.some(p => {
    const g = detectPoolType(p).group;
    return g !== 'Meteora DAMM' && g !== 'PumpSwap';
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[]  = [];
  const poolErrors: { pairAddress: string; msg: string }[] = [];

  for (const pair of dammPools) {
    try {
      const ammRes  = await fetch(`https://amm-v2.meteora.ag/pools?address=${pair.pairAddress}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ammData: any = await ammRes.json();
      if (!Array.isArray(ammData) || !ammData[0]?.lp_mint) continue;
      const { lp_mint: lpMint, pool_name: poolName } = ammData[0];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supplyRes: any = await solRpc('getTokenSupply', [lpMint]);
      const totalSupply = parseFloat(supplyRes?.value?.uiAmount || 0);
      if (!totalSupply) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const holdersRes: any = await solRpc('getTokenLargestAccounts', [lpMint]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topAccts: any[] = holdersRes?.value || [];
      if (!topAccts.length) continue;

      const tAcctAddrs = topAccts.map((h: any) => h.address);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsedRes: any = await solRpc('getMultipleAccounts', [tAcctAddrs, { encoding: 'jsonParsed' }]);
      const ownerAddrs: (string | null)[] = (parsedRes?.value || []).map(
        (a: any) => a?.data?.parsed?.info?.owner || null,
      );

      const validOwners = [...new Set(ownerAddrs.filter(Boolean))] as string[];
      const lockSet = new Set<string>();
      if (validOwners.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ownerRes: any = await solRpc('getMultipleAccounts', [validOwners, { encoding: 'base64' }]);
        (ownerRes?.value || []).forEach((acct: any, i: number) => {
          if (acct?.owner === METEORA_AMM_PROGRAM) lockSet.add(validOwners[i]);
        });
      }

      const holderRows = topAccts.map((h: any, i: number) => ({
        wallet:  ownerAddrs[i] || h.address,
        amount:  parseFloat(h.uiAmount || 0),
        pct:     totalSupply > 0 ? (parseFloat(h.uiAmount || 0) / totalSupply * 100) : 0,
        locked:  ownerAddrs[i] ? lockSet.has(ownerAddrs[i] as string) : false,
      }));

      const unlocked      = holderRows.filter(h => !h.locked);
      const top3Pct       = unlocked.slice(0, 3).reduce((s, h) => s + h.pct, 0);
      const lockedPct     = holderRows.filter(h => h.locked).reduce((s, h) => s + h.pct, 0);
      const flagConcentrated = top3Pct > 60;

      results.push({
        poolName:       poolName || pair.pairAddress.slice(0, 8) + '…',
        pairAddress:    pair.pairAddress,
        holderRows,
        top3Pct,
        lockedPct,
        flagConcentrated,
        unlockedCount:  unlocked.length,
      });
    } catch (e: unknown) {
      poolErrors.push({ pairAddress: pair.pairAddress, msg: (e as Error).message });
    }
  }

  return buildLPOwnershipHTML(results, poolErrors, hasPumpSwap, hasOtherTypes);
}

function buildLPOwnershipHTML(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any[],
  errors: { pairAddress: string; msg: string }[],
  hasPumpSwap: boolean,
  hasOtherTypes: boolean,
): string {
  let html = `<div class="sl">LP ownership concentration</div>`;

  if (hasPumpSwap) {
    html += `<div style="font-size:10px;color:#555552;margin-bottom:8px;padding:6px 10px;border:0.5px solid rgba(255,255,255,0.06);border-radius:4px;background:#0f0f0f;">PumpSwap bonding curve pools excluded — ownership concentration is structural by design and not a risk signal.</div>`;
  }

  errors.forEach(e => {
    html += `<div style="font-size:10px;color:#555552;margin-bottom:6px;padding:5px 10px;border:0.5px solid rgba(201,74,74,0.2);border-radius:4px;">Pool ${sh(e.pairAddress)} — LP data unavailable: ${e.msg}</div>`;
  });

  for (const pool of results) {
    const fc  = pool.flagConcentrated ? '#c94a4a' : '#1D9E75';
    const fl  = pool.flagConcentrated ? '⚠ Concentrated Ownership' : '✓ Distributed';
    const uid = 'lpo_' + pool.pairAddress.slice(0, 8);
    html += `
    <div style="border:0.5px solid rgba(255,255,255,0.08);border-radius:6px;margin-bottom:8px;overflow:hidden;">
      <div style="background:#0f0f0f;padding:10px 14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:11px;color:#e8e8e6;">${pool.poolName}</span>
            <span style="font-size:9px;color:#444442;">${sh(pool.pairAddress)}</span>
          </div>
          <span class="badge" style="background:${fc}22;color:${fc};border:0.5px solid ${fc}44;">${fl}</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
          <div style="background:#161613;border:0.5px solid rgba(255,255,255,0.06);border-radius:4px;padding:5px 10px;flex:1;min-width:80px;">
            <div style="font-size:8px;color:#444442;text-transform:uppercase;letter-spacing:.07em;margin-bottom:2px;">Top-3 unlocked</div>
            <div style="font-size:16px;font-weight:600;color:${fc};">${pool.top3Pct.toFixed(1)}%</div>
            <div style="font-size:9px;color:#444442;">of total supply</div>
          </div>
          <div style="background:#161613;border:0.5px solid rgba(255,255,255,0.06);border-radius:4px;padding:5px 10px;flex:1;min-width:80px;">
            <div style="font-size:8px;color:#444442;text-transform:uppercase;letter-spacing:.07em;margin-bottom:2px;">🔒 Locked LP</div>
            <div style="font-size:16px;font-weight:600;color:#888884;">${pool.lockedPct.toFixed(1)}%</div>
            <div style="font-size:9px;color:#444442;">of total supply</div>
          </div>
          <div style="background:#161613;border:0.5px solid rgba(255,255,255,0.06);border-radius:4px;padding:5px 10px;flex:1;min-width:80px;">
            <div style="font-size:8px;color:#444442;text-transform:uppercase;letter-spacing:.07em;margin-bottom:2px;">Unlocked holders</div>
            <div style="font-size:16px;font-weight:600;color:#888884;">${pool.unlockedCount}</div>
            <div style="font-size:9px;color:#444442;">shown of top 20</div>
          </div>
        </div>
        ${pool.flagConcentrated
          ? `<div style="font-size:10px;color:#c94a4a;margin-bottom:8px;">Top 3 unlocked wallets hold ${pool.top3Pct.toFixed(1)}% of LP supply — significant single-party withdrawal risk. Concentration calculated on unlocked LP only.</div>`
          : `<div style="font-size:9px;color:#444442;margin-bottom:6px;">Concentration calculated on unlocked LP only.</div>`}
        <div onclick="const d=document.getElementById('${uid}');d.style.display=d.style.display==='block'?'none':'block';this.querySelector('.dtgl').textContent=d.style.display==='block'?'▾':'▸';" style="cursor:pointer;display:flex;align-items:center;gap:4px;font-size:9px;color:#555552;user-select:none;">
          <span class="dtgl">▸</span> Show holders
        </div>
      </div>
      <div id="${uid}" style="display:none;border-top:0.5px solid rgba(255,255,255,0.06);">
        ${pool.holderRows.map((h: any, i: number) => `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 14px;${i % 2 === 0 ? 'background:#0a0a0a;' : ''}border-bottom:0.5px solid rgba(255,255,255,0.03);">
          <span style="font-size:9px;color:#333;min-width:16px;">${i + 1}</span>
          <span style="font-size:10px;font-family:monospace;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            <a href="https://solscan.io/account/${h.wallet}" target="_blank" style="color:${h.locked ? '#1D9E75' : '#888884'};text-decoration:none;">${sh(h.wallet)}</a>
          </span>
          <span style="font-size:10px;color:#888884;min-width:55px;text-align:right;">${h.pct.toFixed(1)}%</span>
          ${h.locked ? `<span style="font-size:9px;background:#1D9E7518;color:#1D9E75;border:0.5px solid #1D9E7540;border-radius:3px;padding:1px 5px;white-space:nowrap;flex-shrink:0;">🔒 Locked</span>` : ''}
        </div>`).join('')}
      </div>
    </div>`;
  }

  if (hasOtherTypes) {
    html += `<div style="font-size:11px;color:#555552;padding:10px 14px;border:0.5px solid rgba(255,255,255,0.06);border-radius:6px;background:#0f0f0f;margin-bottom:12px;">LP position data for DLMM and CLMM pools requires on-chain position account indexing — not available client-side without an RPC key. Available in Phase 3 with Helius integration.</div>`;
  }

  return html;
}
