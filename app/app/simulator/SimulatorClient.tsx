'use client';

import { useState } from 'react';
import { simulateDamm } from '../../lib/simulator/damm';
import { simulateDlmm, type Side, type Shape } from '../../lib/simulator/dlmm';
import { renderDammResult, renderDlmmResult } from '../../lib/simulator/render';

type Mode = 'damm' | 'dlmm';

const ACTIVE: Record<Mode, string> = { damm: '#1D9E75', dlmm: '#378ADD' };

const SIDES: { key: Side; label: string }[] = [
  { key: 'two', label: '2-Sided' },
  { key: 'dca-in', label: '1-Sided DCA-in (buy)' },
  { key: 'dca-out', label: '1-Sided DCA-out (sell)' },
];
const SHAPES: { key: Shape; label: string }[] = [
  { key: 'spot', label: 'Spot' },
  { key: 'curve', label: 'Curve' },
  { key: 'bidask', label: 'Bid-Ask' },
];

function toggleStyle(active: boolean, color: string): React.CSSProperties {
  return active
    ? { borderColor: color, color, background: `${color}1a` }
    : {};
}

export default function SimulatorClient() {
  const [mode, setMode] = useState<Mode>('damm');
  const [side, setSide] = useState<Side>('two');
  const [shape, setShape] = useState<Shape>('bidask');
  const [outputHTML, setOutputHTML] = useState('');

  const g = (id: string) =>
    (document.getElementById(id) as HTMLInputElement | HTMLSelectElement)?.value;
  const gn = (id: string, fallback: number) => parseFloat(g(id) || '') || fallback;

  function runDamm() {
    const startValue = gn('d-value', 1000);
    const entryMC = gn('d-mc', 50_000);
    const currency = g('d-cur') || 'USDC';
    const result = simulateDamm({ startValue, entryMC });
    setOutputHTML(renderDammResult(result, { currency, entryMC }));
  }

  function runDlmm() {
    const binStep = gn('l-binstep', 20);
    const low = gn('l-low', 0.00005);
    const high = gn('l-high', 0.0002);
    const entryMC = gn('l-mc', 0) || undefined;
    const currency = g('l-cur') || 'USDC';
    let baseAmt = gn('l-base', 5_000_000);
    let quoteAmt = gn('l-quote', 500);
    // Single-sided positions only deposit one asset, and the current price sits
    // at the near edge: DCA-out sells up from the bottom, DCA-in buys down from the top.
    let entryPrice = gn('l-entry', 0.0001);
    if (side === 'dca-out') { quoteAmt = 0; entryPrice = Math.min(entryPrice, low); }
    if (side === 'dca-in') { baseAmt = 0; entryPrice = Math.max(entryPrice, high); }

    const result = simulateDlmm({
      side,
      shape,
      binStep,
      low,
      high,
      entryPrice,
      entryMC,
      baseAmt,
      quoteAmt,
    });
    setOutputHTML(
      renderDlmmResult(result, { side, shape, binStep, low, high, entryPrice, currency })
    );
  }

  function run() {
    if (mode === 'damm') runDamm();
    else runDlmm();
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
        Simulator — LP Growth Projection
      </div>
      <div style={{ fontSize: 11, color: '#bdbdb7', marginBottom: 16 }}>
        Projects LP position value across price / market cap from price appreciation alone — no fees.
      </div>

      {/* ── Mode toggle ── */}
      <div className="sl">Pool type</div>
      <div className="obj-row">
        <button
          className="obj-btn"
          style={toggleStyle(mode === 'damm', ACTIVE.damm)}
          onClick={() => { setMode('damm'); setOutputHTML(''); }}
        >
          DAMM v2 — full range
        </button>
        <button
          className="obj-btn"
          style={toggleStyle(mode === 'dlmm', ACTIVE.dlmm)}
          onClick={() => { setMode('dlmm'); setOutputHTML(''); }}
        >
          DLMM — concentrated bins
        </button>
      </div>

      {mode === 'damm' ? (
        <>
          <div className="sl" style={{ marginTop: 12 }}>Position</div>
          <div className="igrid">
            <div className="field">
              <label>Starting LP Value ($)</label>
              <input id="d-value" type="number" defaultValue="1000" />
            </div>
            <div className="field">
              <label>Entry Market Cap ($)</label>
              <input id="d-mc" type="number" defaultValue="50000" />
            </div>
            <div className="field">
              <label>Quote Currency</label>
              <select id="d-cur" defaultValue="USDC">
                <option>USDC</option>
                <option>SOL</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#9c9c97', marginTop: -6, marginBottom: 6 }}>
            DAMM is a 50/50 full-range pool, so the starting LP value is split evenly across both sides. Simulated against a fixed MC ladder: $50K → $10M.
          </div>
        </>
      ) : (
        <>
          <div className="sl" style={{ marginTop: 12 }}>Structure</div>
          <div className="obj-row">
            {SIDES.map((s) => (
              <button
                key={s.key}
                className="obj-btn"
                style={toggleStyle(side === s.key, ACTIVE.dlmm)}
                onClick={() => setSide(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="sl" style={{ marginTop: 10 }}>Liquidity shape</div>
          <div className="obj-row">
            {SHAPES.map((s) => (
              <button
                key={s.key}
                className="obj-btn"
                style={toggleStyle(shape === s.key, '#7F77DD')}
                onClick={() => setShape(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="sl" style={{ marginTop: 12 }}>Position</div>
          <div className="igrid">
            <div className="field">
              <label>Bin Step (bps)</label>
              <select id="l-binstep" defaultValue="20">
                <option>1</option><option>2</option><option>5</option><option>10</option>
                <option>20</option><option>50</option><option>100</option>
              </select>
            </div>
            <div className="field">
              <label>Entry Price ($)</label>
              <input id="l-entry" type="number" defaultValue="0.0001" step="any" />
            </div>
            <div className="field">
              <label>Range Low Price ($)</label>
              <input id="l-low" type="number" defaultValue="0.00005" step="any" />
            </div>
            <div className="field">
              <label>Range High Price ($)</label>
              <input id="l-high" type="number" defaultValue="0.0002" step="any" />
            </div>
            <div className="field">
              <label>Token Amount {side === 'dca-in' ? '(n/a — buy only)' : ''}</label>
              <input id="l-base" type="number" defaultValue="5000000" disabled={side === 'dca-in'} />
            </div>
            <div className="field">
              <label>Quote Amount ($) {side === 'dca-out' ? '(n/a — sell only)' : ''}</label>
              <input id="l-quote" type="number" defaultValue="500" disabled={side === 'dca-out'} />
            </div>
            <div className="field">
              <label>Quote Currency</label>
              <select id="l-cur" defaultValue="USDC">
                <option>USDC</option>
                <option>SOL</option>
              </select>
            </div>
            <div className="field">
              <label>Entry MC ($) — optional, for MC labels</label>
              <input id="l-mc" type="number" defaultValue="100000" step="any" />
            </div>
          </div>
        </>
      )}

      <button className="rbtn" onClick={run} style={{ marginTop: 8 }}>
        ▶ Simulate
      </button>

      <div className="out" style={{ marginTop: 12 }}>
        {outputHTML ? (
          <div dangerouslySetInnerHTML={{ __html: outputHTML }} />
        ) : (
          <span className="ph2">Set your position and simulate to project LP value across price.</span>
        )}
      </div>
    </div>
  );
}
