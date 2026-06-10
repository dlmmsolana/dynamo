# Current State — Liquidity Terminal v0.2.2

Last updated: Session 6 (Phase 2 complete — all fixes applied)

---

## What is built

Single file: `index.html`
Runs locally via File → Open in Chrome or Firefox.
No server, no auth, no backend.

---

## Tab: Auditor

### Input
- Token mint address (Solana)
- Optimization objective selector: Fee Generation / Price Stability / Volume Growth / Balanced

### Data source
- DexScreener: `https://api.dexscreener.com/latest/dex/tokens/{address}`
- Returns all pools for the token on Solana DEXs

### Risk Assessment (shown first, before all other output)
- `buildRiskSection(mc, fdv, tvl, vol24, liqRatio, volLiq, priceChg, pairs)` runs for every audit
- Multi-factor risk score 0–100 with verdict: Pass (<20) / Caution (<45) / High Risk (<70) / Do Not Touch (≥70)
- Risk signals scored and sorted red → amber → green → stubs:
  - Extreme liq ratio / holder concentration proxy (up to 28 pts red)
  - FDV/MC supply overhang >20x (25 pts red), >5x (12 pts amber)
  - Vol/liq wash-trading signal >20x (25 pts red), >8x (10 pts amber)
  - Micro TVL <$2K (22 pts red), <$10K (10 pts amber)
  - Pool age <24h (18 pts red), <72h (8 pts amber)
  - Extreme price action >200% or <−70% (15 pts amber)
  - Single-pool dependency on large token (8 pts amber)
  - Bonding curve active (5 pts amber)
  - Healthy liq ratio >10% (−10 pts green), >5% (−5 pts green)
  - Multi-DEX presence ≥2 DEXes + ≥3 pools (−5 pts green)
- Stubs (no score): mint authority, freeze authority, LP lock — "Requires on-chain verification (Helius RPC — Phase 3)"
- Visual: colored border matching verdict, score progress bar, per-flag list with dot, pts, and rationale

### Sub-$40K MC comparison (shown between slippage estimator and fragmentation score)
- `buildMicroCapSection(mc, volLiq, tvl)` renders only when MC < $40K
- `buildMicroCapTable(mc, volLiq, tvl, ref)` shows DAMM vs Spot IL math at $100K / $250K / $1M milestones
- Capital toggle: $100 / $250 / $500 / $1K — re-renders table in place via `setMicroCapRef(ref, el)` without re-audit
- Recommendation logic by vol/liq tier: Pass (<0.01) / Wide DLMM+Spot (≥0.30) / Combination (≥0.10) / DAMM (≥0.03) / Spot only (<0.03)
- Shows: DAMM position value at milestone, spot equivalent, IL drag, daily fee estimate, break-even days

### What is computed
- Total TVL (sum across all pools)
- Total 24h volume
- Liquidity ratio (TVL / MC)
- Vol/Liq ratio
- Est. daily fees (vol × 0.003, assumes 0.3% blended fee tier)
- Fee density (fees / TVL)
- Volatility regime: inferred from avg abs 24h price change across top 5 pools
  - < 5% → Low, 5–10% → Medium, 10–20% → High, > 20% → Extreme
- Stage classification (0–5) based on market cap
- Recommended DAMM/DLMM/CLMM split per stage
- DLMM shape (Spot/Curve/Bid Ask/Skewed Bullish/Skewed Bearish/Multi Range)
- Range width (adjusted by objective)
- **Slippage estimate** at $500 / $1K / $5K / $10K trade sizes (pool-type concentration model)
- **Fragmentation score** 0–100 (HHI-based, labeled Healthy/Moderate/Fragmented/Severely Fragmented)
- **Routing dominance score** 0–100 (depth vs. target, fragmentation, DEX venue; labeled Dominant/Competitive/Weak/Non-competitive)

### What is displayed
1. Token name, symbol, objective badge — plus **`→ Live LP` button** (export-btn, first in export bar) that writes address to `lp-addr`, switches to Live LP tab, runs `runLiveLP()`
2. Export bar: → Live LP, ↓ Markdown, ↓ CSV, ⎙ Print / PDF
3. Token address (full, for reference)
4. 6 metric cards: price, MC, TVL, vol 24h, liq ratio, est. daily fees
5. **Collapsible details row** (▸/▾ toggle): FDV · pool count · volatility · fee density — collapsed by default, expands to 4 labeled mini-cards
6. Stage badge
7. Recommended allocation bar (DAMM/DLMM/CLMM)
8. DLMM config line: shape, range, bin step, treasury LP target
9. TVL donut chart grouped by pool type (`buildDonutChart`)
10. Pool inventory table (scrollable horizontally):
    - DEX name, pool type badge, TVL, Vol 24h, Fees 24h, Utilization, 24h Δ, links
11. **Slippage estimator**: trade impact at $500/$1K/$5K/$10K
12. **Sub-$40K MC section** (only when MC < $40K): DAMM vs Spot IL math, capital toggle
13. **Fragmentation score**: 0–100, labeled
14. **Routing dominance score**: 0–100, labeled
15. Analysis section: 4 paragraphs, distinct specialist voice per objective

### Known issues
- Fee tier assumption (0.3%) is a blunt estimate — varies by pool
- Volatility inferred from price change, not actual bin data
- Slippage model uses concentration factor proxies, not real bin data
- No treasury ownership breakdown

### Export
- **Markdown**: downloads `.md` file with metrics table, pool table, full analysis
- **CSV**: downloads pool inventory as `.csv`
- **Print/PDF**: opens new browser window with 3-page professional white document, then triggers print dialog
  - Page 1: Cover (token name, address, 6 metrics, stage, objective)
  - Page 2: Metrics grid, allocation bar, donut chart, pool inventory table
  - Page 3: Analysis with numbered sections, disclaimer
  - Uses Inter font from Google Fonts
  - `print-color-adjust: exact` for color preservation

---

## Tab: Discover

First tab. State is lazy-loaded on first tab switch.

### Mode and time controls
- **Volume mode** (default): ranks by vol for selected time period
- **MC Change mode**: ranks by price change % for selected time period
- **Time selector**: 1h / ~4h / ~12h / 24h (always visible for both modes)
  - 1h → `volH1` / `priceH1`
  - ~4h → `volH6 × (4/6)` / `priceH6 × (4/6)` (estimated from h6)
  - ~12h → `(volH6 + vol24) / 2` / `(priceH6 + priceH24) / 2` (estimated)
  - 24h → `vol24` / `priceH24`
- Sort re-runs instantly on mode or time change without re-fetching

### Trending feed
- Pulls from DexScreener `token-boosts/top/v1` (top 20 Solana tokens)
- Batch-fetches pair data; aggregates per token: TVL, vol24, volH1, volH6 (summed across pools); priceH1, priceH6, priceH24 from highest-vol pair
- Renders `disc-card` grid per token
- Card actions: ⊕ Audit (switches to Auditor + runs), ⚡ Live LP (switches to Live LP + runs), + Portfolio

### Search
- Input accepts ticker ($ORE), token name, or full contract address
- Queries `latest/dex/search?q={query}`, filters to Solana
- Results in same `disc-card` format; "← Trending" button calls `restoreDiscover()` which calls `renderDiscGrid()` using cached `discTokenData`

### Global state
```js
let discoverLoaded = false;   // prevents duplicate trending fetch on re-visit
let discMode = 'volume';      // 'volume' | 'mcchange'
let discTime = '24';          // '1' | '4' | '12' | '24'
let discTokenData = null;     // cached token array for re-sort without re-fetch
```

---

## Tab: Live LP

Second tab. Input-only — no discovery or trending feed. Token address must be entered manually or pre-filled by a cross-navigation button.

### Inputs
- Token mint address
- Capital to deploy ($)
- Risk tolerance: Conservative / Moderate / Aggressive
- Time horizon: <1 week / 1–4 weeks / 1–3 months / 3+ months
- Primary goal: Max fees / Capital protection / Volume support / Balanced

### What is computed
- Fetches DexScreener data for the token
- Decision tree by MC tier:
  - < $5K: vol24 < $200 → Pass; else → DAMM + Spot (60/40)
  - $5K–$40K: DAMM vs Spot rationale text (standalone, no buildMicroCapSection)
  - $40K–$150K: Wide DLMM (Bid Ask, bin step 300–400) + spot hedge
  - $150K–$500K (Tier D): DLMM-only — rangebound → Medium DLMM; trending/volatile → Wide DLMM
  - $500K+: 7-branch tree (No Action / Spot Buy / DAMM / Wide DLMM / Tight DLMM / No LP / Custom)
- Universal blockers checked first: zero vol → No LP; Extreme vola + Days horizon → No Action; strong directional momentum → Spot Buy

### What is displayed
1. Token name, symbol, stage badge — plus **`→ Full Audit` button** (export-btn style) that writes address to `audit-addr`, switches to Auditor, runs `runAudit()`
2. 6 metric cards: price, MC, TVL, vol 24h, vol/liq, liq ratio
3. Styled recommendation card (color border matching decision):
   - Decision badge + risk/horizon/goal context
   - Capital amount display
   - Rationale paragraph
4. Configuration block (if LP recommended): pool type, shape, range, bin step, allocation
5. Expected outcomes, risk flags, what to watch list
6. **Pool inventory table**: `buildPoolRows(pairs)` with `pool-wrap` / `ph` header — same structure as Auditor

---

## Tab: Architect

### Inputs
- Token design: supply, FDV, initial MC, capital to deploy, treasury %, LP %
- Growth assumptions: 30d / 90d / 180d / 365d MC targets
- Trading assumptions: daily vol, volatility (select), B/S ratio, holders, top-10 concentration
- **Optimization objective selector: Fee Generation / Price Stability / Volume Growth / Balanced** (new in Phase 2)

### What is computed
- Stage classification at current MC
- DAMM/DLMM/CLMM split adjusted by objective (`dlmmBias`, `reservePct` from `objConfig`)
- Specific Meteora bin steps per objective (1–2 for Fee, 5–10 for Volume, 10 for Balanced, 20–50 for Stability)
- DLMM shape and range width (objective-aware)
- Dollar amounts: DAMM allocation, DLMM allocation, CLMM allocation, reserve
- Est. daily fees at stated volume
- Migration triggers per stage
- Lifecycle table: $ amounts at each MC milestone (Launch / $50K / $250K / $1M / $5M / $10M)
- Migration roadmap steps (for each growth target that crosses a stage boundary)

### What is displayed
1. 6 metric cards: MC, capital, liq ratio, vol/liq, est. daily fees, CRI
2. Stage badge + DLMM shape + range
3. Allocation bar with $ labels
4. Deployment plan table: pool type, $ amount, configuration details, migration trigger
5. Migration roadmap: numbered steps with triggers and actions
6. Lifecycle capital plan table: $ at each milestone
7. Written analysis: 4 paragraphs, **distinct specialist voice per objective** (new in Phase 2)

### Known issues
- No pool creation checklist output
- No integration with real Meteora bin data (bin steps are rule-based)

---

## Tab: Portfolio

### Inputs
- Token mint address (up to 10)

### Data source
- Same DexScreener endpoint as Auditor

### What is stored
- localStorage key: `slt_portfolio`
- Array of token objects with cached DexScreener data

### What is displayed
- Card per token:
  - Name, symbol, stage badge
  - 24h price change (color coded)
  - MC, TVL, vol 24h, liq ratio (color coded), est. daily fees, pool count
  - **Health score bar**: 0–100, color-coded label (Healthy / Moderate / Weak / Critical)
  - **Attention alert**: one-line warning shown only when triggered (amber or red)
- Click card → switches to Auditor tab and runs full audit for that token
- Remove button per card
- Refresh All button: re-fetches all tokens

### Alert trigger conditions
| Condition | Severity |
|-----------|----------|
| Liq ratio < 2% | Red |
| Health score < 40 | Red |
| Price change < −20% in 24h | Amber |
| Price change > +20% in 24h | Amber |
| Pool count > 8 | Amber |
| Stage 0 + vol/liq < 0.1x | Amber |

### Sort controls
- Stage ↓ (default, highest stage first)
- Stage ↑ (lowest stage first)
- Liq Ratio (highest first)
- Worst Health (lowest health score first)
- A–Z (alphabetical by symbol)

### Tag system
- Optional tag per token: Watching / Active LP / Research / Other
- Stored in localStorage alongside token data
- Clicking tag badge on a card cycles through: null → watching → active-lp → research → other
- Filter row above sort: All / Watching / Active LP / Research / Other

### Known issues
- localStorage only — does not persist across browsers or devices
- No user auth — same portfolio for anyone who opens the file
- Max 50 tokens
- No portfolio-level summary metrics (total TVL, combined fees, count by stage)

---

## Styling / Design System

### Colors (fixed, must not change)
```
Background:    #0f0f0f (primary), #161616 (secondary), #1e1e1e (tertiary)
Border:        rgba(255,255,255,0.08) (primary), rgba(255,255,255,0.16) (secondary)
Text:          #e8e8e6 (primary), #888884 (secondary), #555552 (tertiary)
Green:         #1D9E75 (DAMM, positive, healthy)
Blue:          #378ADD (DLMM)
Orange:        #D85A30 (CLMM, warning)
Amber:         #BA7517 (Raydium, caution)
Red:           #c94a4a (error, critical)
Purple:        #7F77DD (Orca, CPMM)
```

### Stage colors
```
Stage 0 (Launch):       #888780
Stage 1 (Discovery):    #1D9E75
Stage 2 (Emerging):     #378ADD
Stage 3 (Growth):       #BA7517
Stage 4 (Established):  #D85A30
Stage 5 (Institutional):#993556
```

### Font
- UI: SF Mono / Fira Code / Cascadia Code (monospace stack)
- PDF: Inter (loaded from Google Fonts in PDF window only)

---

## Functions Reference (index.html)

| Function | Purpose |
|----------|---------|
| `classifyStage(mc)` | Returns stage object with stage number, label, DAMM/DLMM/CLMM splits |
| `sc(stageNum)` | Returns hex color for stage |
| `getShape(vola, bsr, objective)` | Returns DLMM shape string |
| `getRW(vola, objective)` | Returns range width string e.g. "±15%"; stability objective returns wide fixed ranges |
| `getMig(stageNum)` | Returns migration trigger description |
| `getTLP(stageNum)` | Returns treasury LP % range string |
| `objConfig(objective)` | Returns config object: label, color, rangeAdj, reservePct, dlmmBias (binStep removed — use getBinConfig) |
| `getBinConfig(mc, obj)` | Returns MC-aware bin config {step, fee, desc}: sub-$500K wide bins, $500K–$5M mid, $5M+ tight |
| `detectPoolType(pair)` | Returns pool type object {type, color, group} from DexScreener pair data |
| `poolLinks(pair)` | Returns HTML string of anchor links for the pair |
| `buildPoolRows(pairs)` | Returns HTML string of pool inventory rows |
| `buildDonutChart(pairs, totalTVL)` | Returns HTML string with SVG donut + legend |
| `estSlippage(tradeSize, pairs)` | Returns estimated price impact % for a given trade size using pool-type concentration factors |
| `calcFragScore(pairs)` | Returns HHI-based fragmentation score 0–100 |
| `calcRoutingScore(pairs, tvl, mc)` | Returns routing dominance score 0–100 from 3 factors: depth, fragmentation, DEX venue |
| `buildRiskSection(mc, fdv, tvl, vol24, liqRatio, volLiq, priceChg, pairs)` | Returns HTML risk assessment block: multi-factor score 0–100, verdict badge, per-flag list |
| `buildMicroCapTable(mc, volLiq, tvl, ref)` | Returns HTML comparison table: DAMM vs Spot IL math at $100K/$250K/$1M milestones for given capital ref |
| `buildMicroCapSection(mc, volLiq, tvl)` | Returns HTML micro-cap block with capital toggle buttons + table container; only renders when MC < $40K |
| `setMicroCapRef(ref, el)` | Updates active capital button and re-renders micro-cap table in place without re-audit |
| `runDiscover()` | Fetches trending tokens, stores to `discTokenData`, calls `renderDiscGrid()`; cached after first load |
| `renderDiscGrid()` | Sorts `discTokenData` by `getDiscVal()`, renders disc-card grid with mode/time label |
| `getDiscVal(t)` | Returns sort value for token based on `discMode` + `discTime` (volH1/volH6/vol24 or priceH1/priceH6/priceH24) |
| `getDiscLabel()` | Returns time label string for current `discTime` |
| `setDiscMode(mode, el)` | Updates `discMode`, re-renders grid |
| `setDiscTime(t, el)` | Updates `discTime`, re-renders grid |
| `searchDiscover()` | Reads search input, queries DexScreener search endpoint, renders results |
| `restoreDiscover()` | Clears search, calls `renderDiscGrid()` if `discTokenData` exists, else re-fetches |
| `lifecycle(mc, vola, bsr, capital)` | Returns HTML table rows for lifecycle plan |
| `buildDeployPlan(capital, stage, vola, bsr, mc, vol, objective)` | Returns deploy plan object: rows HTML + dammAmt, dlmmAmt, clmmAmt, resAmt, damm, dlmm, clmm, reservePct, estFees, shape, rw |
| `buildMigSteps(mc, mc30, mc90, mc180, capital, vola, bsr)` | Returns HTML migration step list |
| `archAnalysis(inputs, deploy, objective)` | Returns array of 4 analysis paragraphs; distinct specialist voice per objective |
| `auditAnalysis(inputs, objective)` | Returns array of 4 analysis paragraphs; distinct specialist voice per objective |
| `runLiveLP()` | Fetches token data, runs MC-tiered decision tree, stores addr to `lastLPAddr`, renders recommendation card + pool inventory table |
| `exportMarkdown()` | Downloads .md file from lastAuditData |
| `exportCSV()` | Downloads .csv file from lastAuditData |
| `exportPrint()` | Opens new window with professional PDF document and triggers print |
| `runArchitect()` | Reads inputs, computes everything, renders Architect output |
| `runAudit()` | Fetches DexScreener, computes everything, stores addr to `lastAuditAddr`, renders Auditor output |
| `setPortSort(s, el)` | Updates `portSort`, re-renders portfolio |
| `setPortFilter(f, el)` | Updates `portFilter`, re-renders portfolio |
| `cycleTag(addr, ev)` | Cycles tag on a portfolio token through null → watching → active-lp → research → other |
| `addPortfolioToken()` | Adds token to portfolio (max 50), saves, fetches data |
| `fetchPortfolioToken(addr)` | Fetches single token data and updates portfolio card |
| `refreshPortfolio()` | Re-fetches all portfolio tokens |
| `removePortfolioToken(addr)` | Removes token from portfolio |
| `calcHealthScore(t)` | Returns 0–100 health score from 5 factors: liq ratio, vol/liq, price stability, fragmentation, stage |
| `healthMeta(score)` | Returns {label, color} for a health score |
| `getPortfolioAlert(t, hs)` | Returns {msg, color} for the highest-priority alert, or null if none |
| `renderPortfolio()` | Re-renders all portfolio cards including health score and alert |
| `switchTab(tabName, el)` | Switches active tab |
| `setObj(objective, el)` | Sets audit objective; scoped to #obj-row buttons only |
| `setArchObj(objective, el)` | Sets architect objective; scoped to #arch-obj-row buttons only |

### Global state
```js
let auditObjective = 'fee';        // current audit objective
let archObjective = 'balanced';    // current architect objective
let portfolioTokens = [];          // loaded from localStorage
let portSort = 'stage-desc';       // portfolio sort key
let portFilter = 'all';            // portfolio tag filter
let lastAuditData = null;          // stored after audit for export functions
let lastAuditAddr = '';            // stored after audit for → Live LP cross-nav
let lastLPAddr = '';               // stored after Live LP analysis for → Full Audit cross-nav
let discoverLoaded = false;        // prevents duplicate trending fetch
let discMode = 'volume';           // discover sort mode: 'volume' | 'mcchange'
let discTime = '24';               // discover time window: '1' | '4' | '12' | '24'
let discTokenData = null;          // cached token array for re-sort without re-fetch
let microCapParams = null;         // {mc, volLiq, tvl, ref} — for capital toggle re-render
```

---

## File Structure

```
liquidity-terminal/
├── index.html          # entire app (current, static)
├── CLAUDE.md           # master project doc for Claude Code
├── CURRENT_STATE.md    # this file
└── ROADMAP.md          # living roadmap
```

Target structure (Next.js):
```
liquidity-terminal/
├── CLAUDE.md
├── CURRENT_STATE.md
├── ROADMAP.md
├── package.json
├── next.config.js
├── tailwind.config.js
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── auditor/
│   ├── live-lp/
│   ├── portfolio/
│   └── architect/
├── components/
│   ├── ui/             # shadcn
│   ├── charts/
│   ├── audit/
│   └── portfolio/
├── lib/
│   ├── dexscreener.ts
│   ├── jupiter.ts
│   ├── helius.ts
│   ├── classify.ts     # stage classification, shapes, etc
│   ├── analysis.ts     # recommendation engine
│   └── export.ts
└── supabase/
    └── schema.sql
```
