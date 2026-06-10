# Roadmap — Liquidity Terminal

Living document. Updated each session.

---

## Phase 1 — Static HTML MVP ✓ Complete

Single file, runs locally, no backend.

- [x] Auditor tab with live DexScreener data
- [x] Pool type detection (DLMM / DAMM / CLMM / CPMM / Bonding Curve)
- [x] Pool links (DexScreener, Solscan, native DEX)
- [x] TVL donut chart by pool type group
- [x] 4 optimization objectives with adapted recommendations
- [x] Rules-based written analysis (4 paragraphs)
- [x] Architect tab with dollar-specific deployment plan
- [x] Migration roadmap and lifecycle capital plan
- [x] Portfolio tab (localStorage)
- [x] Export: Markdown, CSV, professional 3-page PDF

---

## Phase 2 — Quality Pass (still static HTML) ✓ Complete (all 2A–2P)

### 2A — Objective differentiation ✓
- [x] Rewrite objective strategy engine from scratch
  - Fee Generation: vol/liq viability gate, fee density math, rebalancing cadence by volatility
  - Price Stability: DAMM-first non-negotiable, reflexivity loop, migration holdback warning
  - Volume Growth: Jupiter routing game framing, median trade size target, single-pool mandate
  - Balanced: portfolio theory framing (DAMM=defense, DLMM=yield, reserve=tactical)
- [x] Each objective produces a strategy a generalist would not produce
- [x] `objConfig()` updated with specific Meteora bin steps (1, 2, 5, 10, 20, 50)
- [x] `getRW()` stability objective returns proper wide ranges (±30–70%)

### 2B — Live LP tab ✓
- [x] New tab between Auditor and Portfolio
- [x] Decision tree: No action / Spot buy / DAMM / Wide DLMM / Tight DLMM / No LP / Custom (7 branches)
- [x] Inputs: token address, capital to deploy, risk tolerance, time horizon, primary goal
- [x] Output: styled recommendation card matching terminal design system
- [x] Color-coded decision badge, metric row, formatted config block
- [x] Expected outcomes: fee yield estimate, IL exposure, break-even vol/liq
- [x] Risk flags (bulleted) and "What to watch" list (bulleted)

### 2C — Auditor depth additions ✓
- [x] Slippage estimator: $500 / $1K / $5K / $10K trade impact (pool-type concentration model)
- [x] Pool fragmentation score (0–100, HHI-based, Healthy/Moderate/Fragmented/Severely Fragmented)
- [x] Routing dominance score (0–100, 3-factor: depth vs. target, fragmentation, DEX venue)
- [ ] Treasury ownership estimate — deferred to Phase 3 (requires on-chain data)
- [ ] IL exposure estimate per pool type — deferred to Phase 4

### 2D — Architect improvements ✓
- [x] Add objective selector (same 4 as Auditor), scoped to Architect tab only
- [x] Deployment plan responds to objective (dlmmBias, reservePct, bin step, range width)
- [x] Specific bin step recommendations per objective (actual Meteora numbers)
- [x] `archAnalysis()` rewritten with 4 distinct specialist voices
- [ ] Pool creation checklist output — deferred to Phase 3

### 2E — Portfolio improvements ✓
- [x] Per-token health score (0–100): 5-factor composite (liq ratio, vol/liq, price stability, fragmentation, stage)
- [x] Attention alerts: one-line, color-coded, shown only when triggered (6 trigger conditions)
- [ ] Portfolio-level summary metrics — deferred to Phase 3
- [ ] Dominant pool type per token card — deferred to Phase 3

### 2F — Live token discovery feed ✓
- [x] Trending token feed pulled from DexScreener token-boosts API, ranked by boost activity + 24h volume
- [x] Search by ticker ($ORE), token name, or full contract address
- [x] Discover tab added between Auditor and Live LP; `runDiscover()` loads feed lazily on first tab switch
- [x] One-click from feed card → run full Auditor audit

### 2G — DLMM bin step and fee tier overhaul ✓
- [x] `getBinConfig(mc, obj)` replaces all static bin step references throughout the app
- [x] Updated thresholds: sub-$500K MC → wide bins (250–400 bps) + high fees (2–4%); $500K–$5M → mid bins (80–200 bps) + 0.5–2%; $5M+ → tight bins (25–100 bps) + 0.25–1%
- [x] All bin step recommendations in Auditor, Live LP, Architect, and `auditAnalysis`/`archAnalysis` updated to use `getBinConfig`
- [x] `objConfig()` `binStep` field removed; replaced everywhere with `getBinConfig(mc, obj).desc`

### 2H — Sub-$40K MC decision logic overhaul ✓
- [x] `buildMicroCapSection(mc, volLiq, tvl)` renders full comparison block when MC < $40K
- [x] `buildMicroCapTable(mc, volLiq, tvl, ref)` shows DAMM vs Spot IL math at $100K / $250K / $1M MC milestones
- [x] Capital toggle: $100 / $250 / $500 / $1K — re-renders table without re-running audit via `microCapParams` global
- [x] `setMicroCapRef(ref, el)` updates active button and rebuilds inner table
- [x] Recommendation logic: Pass / Wide DLMM+Spot / Combination / DAMM / Spot-only — based on vol/liq ratio tiers
- [x] Inserted between slippage estimator and fragmentation score in Auditor output

### 2I — Rug / pass filter ✓
- [x] `buildRiskSection(mc, fdv, tvl, vol24, liqRatio, volLiq, priceChg, pairs)` — multi-factor risk scoring 0–100
- [x] Signals: liq concentration proxy, FDV/MC supply overhang, vol/liq wash-trading, micro TVL, pool age, extreme price action, single-pool dependency, bonding curve
- [x] Green signals reduce score: healthy liq ratio, multi-DEX presence
- [x] Stubs: mint authority, freeze authority, LP lock — "Requires on-chain verification (Helius RPC — Phase 3)"
- [x] Output: Pass (<20) / Caution (<45) / High Risk (<70) / Do Not Touch (≥70) with colored badge, score bar, per-flag reasoning sorted red → amber → green → stubs
- [x] Inserted at very top of Auditor output, before metric cards

### 2J — Tab reorder ✓
- [x] New tab order: Discover → Live LP → Auditor → Portfolio → Architect
- [x] Tab bar HTML updated; `panel-discover` is default active panel

### 2K — Discover card Live LP button ✓
- [x] Third action button "⚡ Live LP" on every Discover card
- [x] `openLiveLPFromDiscover(addr)` writes address to `lp-addr`, switches tab, calls `runLiveLP()`

### 2L — Portfolio sort and scale ✓
- [x] Token limit raised from 10 → 50
- [x] Sort controls: Stage ↓ (default) / Stage ↑ / Liq Ratio / Worst Health / A–Z
- [x] Tag system: watching / active-lp / research / other — cycling via click, stored in localStorage
- [x] Filter row: All / Watching / Active LP / Research / Other

### 2M — Live LP trending feed ✓ (then removed in Session 6)
- [x] Built and later removed per Session 6 corrections — Live LP is input-only by design
- [x] Trending feed lives in Discover tab only (correct architecture per product spec)

### 2N — Live LP lowcap decision tree refinement ✓
- [x] Sub-$5K: Pass (vol < $200/day) or DAMM + Spot 60/40 (DAMM compounds at discovery; spot holds upside)
- [x] $5K–$40K: DAMM / DAMM + Spot / Spot-only based on vol/liq tiers (≥0.5x / 0.1–0.5x / <0.1x)
- [x] $40K–$150K: Wide DLMM (Bid Ask, bin step 300–400) + 35% spot hedge
- [x] $150K–$500K: DLMM-only, two paths — range-bound → Medium DLMM; trending/volatile → Wide DLMM. No DAMM, no reserve.
- [x] $500K+: existing logic unchanged

### 2O — UI declutter ✓
- [x] Panel/section padding, font sizes, and spacing tightened throughout
- [x] Collapsible details row in Auditor output (FDV / Pools / Volatility / Fee Density)
- [x] Secondary info removed from main metric row; lives in collapsible only

### 2P — LP ownership concentration ✓
- [x] New async section in Auditor, inserted between routing dominance score and analysis paragraphs
- [x] PumpSwap pools excluded entirely — bonding curve structure is concentrated by design
- [x] Meteora DAMM/DYN pools: 4-step fetch — `amm-v2.meteora.ag` → `getTokenLargestAccounts` → `getMultipleAccounts` (resolve owners) → `getMultipleAccounts` (lock escrow check)
- [x] Lock escrow detection: owner account owned by Meteora AMM program `Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB` → labeled 🔒 Locked
- [x] Concentration flag: top-3 unlocked wallets > 60% of total LP supply → red "⚠ Concentrated Ownership" badge
- [x] Note: "Concentration calculated on unlocked LP only"
- [x] DLMM / CLMM / other pool types: Phase 3 stub (requires Helius RPC for position indexing)
- [x] Section loads async after main render — no blocking; shows loading indicator while fetching
- [x] Per-pool errors shown inline; single pool failure does not break other pools
- [x] Original spec (Solscan API) revised — Solscan v1 is dead, v2 requires paid key; replaced with Solana public RPC + amm-v2.meteora.ag

---

## Phase 3 — Vercel Deploy (Next.js migration) ← NEXT

Migrate from static HTML to a proper web application.

### 3A — Framework migration
- [ ] Initialize Next.js 14 project (App Router, TypeScript)
- [ ] Migrate all logic to TypeScript modules
- [ ] Tailwind CSS + shadcn/ui component system
- [ ] React Query for data fetching and caching
- [ ] Preserve all existing functionality

### 3B — Auth + persistent portfolio
- [ ] Supabase project setup
- [ ] Email/password auth (simple, no OAuth)
- [ ] Portfolio stored in Supabase (not localStorage)
- [ ] Portfolio syncs across browser sessions and team members
- [ ] DB schema: portfolios, audit_cache, audit_snapshots

### 3C — Server-side improvements
- [ ] API routes for DexScreener (avoid CORS, add caching)
- [ ] Audit cache: don't re-fetch same token within 5 minutes
- [ ] Helius RPC integration: real holder counts, supply data
- [ ] Birdeye integration: historical volume, price trends

### 3D — UI polish
- [ ] Responsive layout for laptop/desktop
- [ ] Loading states and skeleton screens
- [ ] Error boundaries and graceful degradation
- [ ] Toast notifications for actions

---

## Phase 4 — Intelligence Layer

Make the recommendation engine smarter with real data.

### 4A — Backtesting engine
- [ ] Ingest historical Solana token data (DexScreener historical, Birdeye)
- [ ] Answer questions from historical data:
  - Which DLMM distributions worked best between $100k–$1M MC?
  - What liq/MC ratios correlate with sustainable volume growth?
  - At what stage should DAMM typically migrate to DLMM?
  - Which treasury-owned liq structures produced best long-term treasury growth?
- [ ] Use findings to calibrate recommendation engine thresholds
- [ ] Surface "similar tokens" comparisons in audit output

### 4B — Live bin utilization
- [ ] Meteora API integration for real active bin counts
- [ ] Show which specific bins are active vs dead
- [ ] Bin utilization % (real, not estimated)
- [ ] Trigger alerts when bin utilization drops below threshold

### 4C — Alerts
- [ ] Email alerts (Resend or similar) when:
  - Price exits active DLMM range
  - Liq ratio drops below threshold
  - Large TVL withdrawal detected
  - Stage migration trigger met
- [ ] Webhook support for team Slack/Discord

### 4D — LP position tracker
- [ ] Track specific wallet LP positions (not just tokens)
- [ ] Show actual fees earned per position
- [ ] IL calculator with real entry price data
- [ ] PnL per position (fees earned − IL)

---

## Phase 5 — Scale (future, TBD)

Only if the tool proves useful and team decides to expand.

- [ ] Public-facing version with rate limiting
- [ ] Team collaboration (shared portfolios, shared notes on tokens)
- [ ] Custom PDF report branding (logo, firm name)
- [ ] API access for programmatic audits
- [ ] Multi-chain: Ethereum mainnet, Base, Arbitrum
  - Uniswap v3/v4 CLMMs
  - Aerodrome (Base)
  - Different stage thresholds per chain (ETH MC ranges are larger)

---

## Deferred / Won't do (for now)

- Mobile app — this is a desktop tool for a small team
- Social features — not a community product
- Token discovery / trending — not the focus
- Trading execution — data + recommendations only, no execution
- Paid tiers — free forever for the team

---

## Decision log

| Decision | Rationale |
|----------|-----------|
| Solana first, multi-chain later | Build depth before breadth. Solana has the richest LP tooling (Meteora DLMM) |
| Free forever | Internal team tool. No monetization complexity needed. |
| Small team scope | Auth via Supabase email/password. No complex multi-tenant architecture. |
| No OAuth for now | Overkill for a small internal team. Simple email/pass is fine. |
| Rules-based analysis (not AI API) | Avoid API key dependency and per-call costs. Rules engine is faster, deterministic, and good enough if written with depth. |
| Static HTML first | Ship fast, validate the tool concept before investing in a framework. |
| Next.js for v1 | Standard choice for Vercel, TypeScript support, good DX. |
| Supabase for auth+DB | Free tier is generous, good Next.js integration, Postgres is solid. |
| Tab order: Discover / Live LP / Auditor / Portfolio / Architect | Discover and Live LP are the entry points. Auditor is the deep-dive tool. Portfolio is home base. Architect is specialized/occasional. (Updated 2J) |
