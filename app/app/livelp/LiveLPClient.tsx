'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { fmt } from '../../lib/auditor/format';
import { classifyStage, sc } from '../../lib/auditor/classify';
import { buildPoolRows } from '../../lib/auditor/pools';
import { computeMetrics, computeLPDecision } from '../../lib/livelp/decision';
import { validateAddress, CHAINS } from '../../lib/chains';

export default function LiveLPClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [outputHTML, setOutputHTML] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lastLPAddrRef = useRef('');

  // Expose navigation helper for onclick strings inside dangerouslySetInnerHTML
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any)._dynamo = (window as any)._dynamo || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any)._dynamo.goToAudit = () => {
      if (lastLPAddrRef.current) {
        router.push('/auditor?addr=' + encodeURIComponent(lastLPAddrRef.current));
      }
    };
  }, [router]);

  const runLiveLP = useCallback(async (addrOverride?: string) => {
    const addrEl   = document.getElementById('lp-addr') as HTMLInputElement;
    const addr = (addrOverride || addrEl?.value?.trim() || '').trim();
    if (!addr) { setError('Enter a token mint address.'); return; }
    if (!validateAddress(addr)) { setError(`Invalid address — expected a ${CHAINS.solana.addressHint}.`); return; }

    const capitalEl = document.getElementById('lp-capital') as HTMLInputElement;
    const riskEl    = document.getElementById('lp-risk') as HTMLSelectElement;
    const horizonEl = document.getElementById('lp-horizon') as HTMLSelectElement;
    const goalEl    = document.getElementById('lp-goal') as HTMLSelectElement;

    const capital = parseFloat(capitalEl?.value || '0') || 1000;
    const risk    = riskEl?.value   || 'Moderate';
    const horizon = horizonEl?.value || 'Weeks';
    const goal    = goalEl?.value   || 'Maximize PnL';

    setLoading(true);
    setError('');
    setOutputHTML('');

    try {
      const r = await fetch('/api/dexscreener?address=' + encodeURIComponent(addr));
      if (!r.ok) throw new Error('DexScreener request failed');
      const data = await r.json();

      if (!data.pairs || data.pairs.length === 0) {
        throw new Error('Token not found on DexScreener. Check the address.');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pairs = (data.pairs as any[])
        .filter((p) => p.chainId === 'solana')
        .sort((a, b) => parseFloat(b.liquidity?.usd || 0) - parseFloat(a.liquidity?.usd || 0));

      if (pairs.length === 0) throw new Error('No Solana pools found for this token.');

      lastLPAddrRef.current = addr;

      const metrics  = computeMetrics(pairs);
      const decision = computeLPDecision(metrics, { capital, risk, horizon, goal });

      const { name, symbol, price, mc, fdv, tvl, vol24, liqRatio, volLiq, priceChg, vola, stage: s } = metrics;
      const { decision: dec, decColor, rationale, config, outcomes, risks: riskFlags, watchList } = decision;

      const poolCount = pairs.length;
      const priceStr  = price < 0.001 ? price.toExponential(3) : price < 1 ? price.toFixed(4) : price.toFixed(2);
      const stageColor = sc(s.stage);

      let html = `
        <div class="out">
          <div class="arow" style="margin-bottom:12px;align-items:center;">
            <span style="font-size:1.1em;font-weight:700;color:#e0e0e0;">${name}</span>
            <span style="font-size:.85em;color:#888780;margin-left:6px;">${symbol}</span>
            <span class="badge" style="background:${stageColor};margin-left:8px;">Stage ${s.stage} — ${s.label}</span>
            <span style="font-size:.75em;color:#888780;margin-left:10px;">${poolCount} pool${poolCount !== 1 ? 's' : ''} · ${vola} vola · FDV ${fmt(fdv)}</span>
            <button class="export-btn" onclick="window._dynamo && window._dynamo.goToAudit()" style="margin-left:auto;">→ Full Audit</button>
          </div>

          <div class="mrow">
            <div class="mc2">
              <div class="ml">Price</div>
              <div class="mv">$${priceStr}</div>
              <div class="ms" style="color:${priceChg >= 0 ? '#1D9E75' : '#c94a4a'}">${priceChg >= 0 ? '+' : ''}${priceChg.toFixed(1)}% 24h</div>
            </div>
            <div class="mc2">
              <div class="ml">Market Cap</div>
              <div class="mv">${fmt(mc)}</div>
              <div class="ms">${s.label}</div>
            </div>
            <div class="mc2">
              <div class="ml">TVL</div>
              <div class="mv">${fmt(tvl)}</div>
              <div class="ms">Total liquidity</div>
            </div>
            <div class="mc2">
              <div class="ml">Vol 24h</div>
              <div class="mv">${fmt(vol24)}</div>
              <div class="ms">Last 24 hours</div>
            </div>
            <div class="mc2">
              <div class="ml">Vol / Liq</div>
              <div class="mv" style="color:${volLiq >= 1 ? '#1D9E75' : volLiq >= 0.3 ? '#BA7517' : '#c94a4a'}">${volLiq.toFixed(2)}x</div>
              <div class="ms">Vol density</div>
            </div>
            <div class="mc2">
              <div class="ml">Liq Ratio</div>
              <div class="mv" style="color:${liqRatio >= 5 ? '#1D9E75' : liqRatio >= 2 ? '#BA7517' : '#c94a4a'}">${liqRatio.toFixed(1)}%</div>
              <div class="ms">Liq / MC</div>
            </div>
          </div>

          <div style="background:#141414;border:1px solid ${decColor}40;border-left:3px solid ${decColor};padding:20px 20px 16px;margin:16px 0 12px;border-radius:4px;">
            <div style="font-size:.72em;color:#888780;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">${risk} · ${horizon} · ${goal}</div>
            <div style="font-size:1.75em;font-weight:700;color:${decColor};margin-bottom:6px;">${dec}</div>
            <div style="font-size:.85em;color:#888780;margin-bottom:14px;">${fmt(capital)} to deploy</div>
            <div style="font-size:.88em;line-height:1.7;color:#c0c0c0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${rationale}</div>
          </div>
      `;

      if (config) {
        html += `
          <div class="sl" style="margin-top:20px;">Recommended configuration</div>
          <div style="background:#141414;border:1px solid #2a2a2a;border-radius:4px;overflow:hidden;margin:8px 0 16px;">
            ${Object.entries(config).map(([k, v], i, arr) => `
              <div style="display:flex;align-items:baseline;padding:9px 14px;${i < arr.length - 1 ? 'border-bottom:1px solid #1e1e1e;' : ''}">
                <span style="font-size:.72em;color:#888780;letter-spacing:.04em;text-transform:uppercase;min-width:90px;flex-shrink:0;">${k.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span style="font-size:.85em;color:#e0e0e0;font-family:ui-monospace,monospace;">${v}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      if (outcomes.length || riskFlags.length || watchList.length) {
        html += `
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0;">
            <div style="background:#141414;border:1px solid #1a2a1a;border-radius:4px;padding:12px 14px;">
              <div style="font-size:.7em;color:#1D9E75;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">Expected outcomes</div>
              ${outcomes.map(o => `<div style="font-size:.8em;color:#c0c0c0;margin-bottom:5px;line-height:1.5;">· ${o}</div>`).join('')}
            </div>
            <div style="background:#141414;border:1px solid #2a1a1a;border-radius:4px;padding:12px 14px;">
              <div style="font-size:.7em;color:#c94a4a;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">Risk flags</div>
              ${riskFlags.map(r => `<div style="font-size:.8em;color:#c0c0c0;margin-bottom:5px;line-height:1.5;">· ${r}</div>`).join('')}
            </div>
            <div style="background:#141414;border:1px solid #2a2510;border-radius:4px;padding:12px 14px;">
              <div style="font-size:.7em;color:#BA7517;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">What to watch</div>
              ${watchList.map(w => `<div style="font-size:.8em;color:#c0c0c0;margin-bottom:5px;line-height:1.5;">· ${w}</div>`).join('')}
            </div>
          </div>
        `;
      }

      html += `<div class="sl">Pool inventory</div>`;
      html += buildPoolRows(pairs);
      html += `</div>`;

      setOutputHTML(html);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-run when addr param present on mount
  useEffect(() => {
    const addr = searchParams.get('addr');
    if (!addr) return;
    const addrEl = document.getElementById('lp-addr') as HTMLInputElement;
    if (addrEl) addrEl.value = addr;
    runLiveLP(addr);
  }, [searchParams, runLiveLP]);

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
        Live LP — Personal LP Decision Tool
      </div>

      {/* Input form */}
      <div className="igrid" style={{ marginBottom: 16 }}>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label>Token Address</label>
          <input id="lp-addr" type="text" placeholder="Solana mint address" />
        </div>
        <div className="field">
          <label>Capital ($)</label>
          <input id="lp-capital" type="number" defaultValue="1000" min="1" placeholder="1000" />
        </div>
        <div className="field">
          <label>Risk Tolerance</label>
          <select id="lp-risk">
            <option value="Conservative">Conservative</option>
            <option value="Moderate" selected>Moderate</option>
            <option value="Aggressive">Aggressive</option>
          </select>
        </div>
        <div className="field">
          <label>Time Horizon</label>
          <select id="lp-horizon">
            <option value="Days">Days</option>
            <option value="Weeks" selected>Weeks</option>
            <option value="Months">Months</option>
          </select>
        </div>
        <div className="field">
          <label>Primary Goal</label>
          <select id="lp-goal">
            <option value="Maximize PnL">Maximize PnL</option>
            <option value="Generate yield">Generate yield</option>
            <option value="Support the token">Support the token</option>
            <option value="Speculate">Speculate</option>
          </select>
        </div>
      </div>

      <button
        className="disc-btn primary"
        onClick={() => runLiveLP()}
        disabled={loading}
        style={{ marginBottom: 20 }}
      >
        {loading ? 'Analyzing...' : 'Analyze'}
      </button>

      {error && <div className="err">{error}</div>}
      {loading && <div className="blink">Loading pool data…</div>}

      {outputHTML && (
        <div dangerouslySetInnerHTML={{ __html: outputHTML }} />
      )}
    </div>
  );
}
