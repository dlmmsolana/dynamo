'use client';

import { useState } from 'react';
import { fmt, fmtD } from '../../lib/auditor/format';
import { classifyStage, sc, objConfig } from '../../lib/auditor/classify';
import { buildDeployPlan, buildMigSteps, lifecycle, archAnalysis } from '../../lib/architect/plan';

const OBJECTIVES = [
  { key: 'fee',       label: '⬡ Fee Generation',  cls: 'fee'       },
  { key: 'stability', label: '◈ Price Stability',  cls: 'stability' },
  { key: 'volume',    label: '↑ Volume Growth',    cls: 'volume'    },
  { key: 'balanced',  label: '⊕ Balanced',         cls: 'balanced'  },
] as const;

type ObjKey = 'fee' | 'stability' | 'volume' | 'balanced';

export default function ArchitectClient() {
  const [obj, setObj]           = useState<ObjKey>('balanced');
  const [outputHTML, setOutputHTML] = useState('');

  function runArchitect() {
    const g = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement)?.value;

    const mc      = parseFloat(g('a-mc')      || '0') || 50000;
    const fdv     = parseFloat(g('a-fdv')     || '0') || 500000;
    const capital = parseFloat(g('a-capital') || '0') || 25000;
    const vol     = parseFloat(g('a-vol')     || '0') || 5000;
    const treasury= parseFloat(g('a-treasury')|| '0') || 20;
    const top10   = parseFloat(g('a-top10')   || '0') || 40;
    const holders = parseFloat(g('a-holders') || '0') || 100;
    const mc30    = parseFloat(g('a-mc30')    || '0') || 250000;
    const mc90    = parseFloat(g('a-mc90')    || '0') || 1000000;
    const mc180   = parseFloat(g('a-mc180')   || '0') || 5000000;
    const vola    = g('a-vola') || 'Medium';
    const bsr     = parseFloat(g('a-bsratio') || '0') || 1.2;

    const s      = classifyStage(mc);
    const c      = sc(s.stage);
    const deploy = buildDeployPlan(capital, s, vola, bsr, mc, vol, obj);
    const migs   = buildMigSteps(mc, mc30, mc90, mc180, capital, vola, bsr);
    const lc     = lifecycle(mc, vola, bsr, capital);
    const paras  = archAnalysis({ mc, fdv, capital, vol, vola, bsr, treasury, top10, holders, mc30, mc90 }, deploy, obj);
    const cfg    = objConfig(obj);

    const liqMCRatio = (capital / mc * 100);
    const volLiq     = vol / capital;

    const html = `
      <div class="mrow">
        <div class="mc2"><div class="ml">Market Cap</div><div class="mv">${fmt(mc)}</div></div>
        <div class="mc2"><div class="ml">Capital to Deploy</div><div class="mv">${fmtD(capital)}</div></div>
        <div class="mc2">
          <div class="ml">Liq/MC Ratio</div>
          <div class="mv">${liqMCRatio.toFixed(1)}%</div>
          <div class="ms">${liqMCRatio < 3 ? '⚠ too thin' : liqMCRatio < 8 ? '⚠ below target' : '✓ healthy'}</div>
        </div>
        <div class="mc2"><div class="ml">Vol/Liq</div><div class="mv">${volLiq.toFixed(2)}x</div></div>
        <div class="mc2">
          <div class="ml">Est. Daily Fees</div>
          <div class="mv">${fmtD(deploy.estFees)}</div>
          <div class="ms">at current vol</div>
        </div>
        <div class="mc2">
          <div class="ml">CRI Top 10</div>
          <div class="mv">${top10}%</div>
          <div class="ms">${top10 > 50 ? '⚠ extreme' : top10 > 35 ? '⚠ elevated' : '✓ ok'}</div>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:12px;margin:10px 0;">
        <span class="badge" style="background:${c}22;color:${c};border:0.5px solid ${c}44;font-size:11px;padding:3px 10px;">Stage ${s.stage}: ${s.label}</span>
        <span style="font-size:11px;color:#888884;">Shape → <strong style="color:#e8e8e6;">${deploy.shape}</strong> · ${deploy.rw}</span>
        <span class="badge" style="background:${cfg.color}22;color:${cfg.color};border:0.5px solid ${cfg.color}44;font-size:11px;padding:3px 10px;">${cfg.label}</span>
      </div>

      <div class="lrow">
        <span class="ldot" style="background:#1D9E75;"></span><span class="llbl">DAMM ${deploy.damm}% · ${fmtD(deploy.dammAmt)}</span>
        <span class="ldot" style="background:#378ADD;"></span><span class="llbl">DLMM ${deploy.dlmm}% · ${fmtD(deploy.dlmmAmt)}</span>
        ${deploy.clmm > 0 ? `<span class="ldot" style="background:#D85A30;"></span><span class="llbl">CLMM ${deploy.clmm}% · ${fmtD(deploy.clmmAmt)}</span>` : ''}
        <span class="ldot" style="background:#2a2a2a;border:0.5px solid #444;"></span><span class="llbl">Reserve ${fmtD(deploy.resAmt)}</span>
      </div>
      <div class="abar">
        <div class="fd"  style="width:${deploy.damm}%"></div>
        <div class="fdl" style="width:${deploy.dlmm}%"></div>
        <div class="fcl" style="width:${deploy.clmm}%"></div>
        <div style="background:#222;flex:1;"></div>
      </div>

      <div class="sl" style="margin-top:18px;">Deployment plan</div>
      <div style="border:0.5px solid rgba(255,255,255,0.08);border-radius:6px;overflow-x:auto;margin-bottom:16px;">
        <table class="dtable">
          <thead><tr><th>Pool</th><th>Amount</th><th>Configuration</th><th>Migration trigger</th></tr></thead>
          <tbody>${deploy.rows}</tbody>
        </table>
      </div>

      <div class="sl">Migration roadmap</div>
      <div style="margin-bottom:16px;">
        ${migs || '<span style="color:#555552;font-size:11px;">No migrations needed — targets within current stage.</span>'}
      </div>

      <div class="sl">Lifecycle capital plan</div>
      <div style="overflow-x:auto;margin-bottom:16px;">
        <table class="lt" style="min-width:680px;">
          <colgroup>
            <col style="width:65px"><col style="width:95px"><col style="width:90px">
            <col style="width:90px"><col style="width:80px"><col style="width:110px">
            <col style="width:65px"><col>
          </colgroup>
          <thead>
            <tr><th>MC</th><th>Stage</th><th>DAMM</th><th>DLMM</th><th>CLMM</th><th>Shape</th><th>Range</th><th>Migration trigger</th></tr>
          </thead>
          <tbody>${lc}</tbody>
        </table>
      </div>

      <div class="analysis">
        <div class="analysis-label">◈ Architecture analysis</div>
        ${paras.map((p) => `<p>${p}</p>`).join('')}
      </div>
    `;

    setOutputHTML(html);
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
        Architect — Liquidity Architecture Designer
      </div>

      {/* ── Token design ── */}
      <div className="sl">Token design</div>
      <div className="igrid">
        <div className="field">
          <label>Total Supply</label>
          <input id="a-supply" type="number" defaultValue="1000000000" />
        </div>
        <div className="field">
          <label>Initial FDV ($)</label>
          <input id="a-fdv" type="number" defaultValue="500000" />
        </div>
        <div className="field">
          <label>Initial Market Cap ($)</label>
          <input id="a-mc" type="number" defaultValue="50000" />
        </div>
        <div className="field">
          <label>Total Capital to Deploy ($)</label>
          <input id="a-capital" type="number" defaultValue="25000" />
        </div>
        <div className="field">
          <label>Treasury Alloc (%)</label>
          <input id="a-treasury" type="number" defaultValue="20" />
        </div>
        <div className="field">
          <label>LP Allocation (%)</label>
          <input id="a-lpalloc" type="number" defaultValue="10" />
        </div>
      </div>

      {/* ── Growth assumptions ── */}
      <div className="sl">Growth assumptions</div>
      <div className="igrid">
        <div className="field">
          <label>30d MC ($)</label>
          <input id="a-mc30" type="number" defaultValue="250000" />
        </div>
        <div className="field">
          <label>90d MC ($)</label>
          <input id="a-mc90" type="number" defaultValue="1000000" />
        </div>
        <div className="field">
          <label>180d MC ($)</label>
          <input id="a-mc180" type="number" defaultValue="5000000" />
        </div>
        <div className="field">
          <label>365d MC ($)</label>
          <input id="a-mc365" type="number" defaultValue="10000000" />
        </div>
      </div>

      {/* ── Trading assumptions ── */}
      <div className="sl">Trading assumptions</div>
      <div className="igrid">
        <div className="field">
          <label>Expected Daily Vol ($)</label>
          <input id="a-vol" type="number" defaultValue="5000" />
        </div>
        <div className="field">
          <label>Volatility</label>
          <select id="a-vola" defaultValue="Medium">
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Extreme</option>
          </select>
        </div>
        <div className="field">
          <label>Buy/Sell Ratio</label>
          <input id="a-bsratio" type="number" defaultValue="1.2" step="0.1" />
        </div>
        <div className="field">
          <label>Initial Holders</label>
          <input id="a-holders" type="number" defaultValue="100" />
        </div>
        <div className="field">
          <label>Top 10 Concentration (%)</label>
          <input id="a-top10" type="number" defaultValue="40" />
        </div>
      </div>

      {/* ── Objective ── */}
      <div className="sl" style={{ marginTop: 4 }}>Optimization objective</div>
      <div className="obj-row">
        {OBJECTIVES.map((o) => (
          <button
            key={o.key}
            className={`obj-btn ${o.cls}${obj === o.key ? ' active' : ''}`}
            onClick={() => setObj(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <button className="rbtn" onClick={runArchitect} style={{ marginTop: 8 }}>
        ▶ Generate Architecture
      </button>

      {/* ── Output ── */}
      <div className="out" style={{ marginTop: 12 }}>
        {outputHTML ? (
          <div dangerouslySetInnerHTML={{ __html: outputHTML }} />
        ) : (
          <span className="ph2">Fill inputs and run to generate your liquidity architecture plan.</span>
        )}
      </div>
    </div>
  );
}
