# CLAUDE.md — Liquidity Terminal

Master reference document for Claude Code. Read this file in full before touching any code.

---

## What This Is

A professional liquidity intelligence platform for Solana (and eventually multi-chain) DeFi. The product helps a small internal team audit token liquidity structures, make LP decisions, design liquidity architecture for new tokens, and track portfolios of tokens across all relevant on-chain venues.

This is an internal team tool, free to use, with no monetization. The output quality needs to be professional enough to share audit reports directly with external projects as a service.

---

## Current State (v1.0 — Next.js on Vercel)

The app has been fully migrated from the single `index.html` file to a Next.js 16 App Router application deployed on Vercel. The static HTML file (`index.html`) is retained as a reference only — all active development happens in `app/`.

### Deployment

- **Live URL:** Vercel (configured, deployed)
- **Auth:** Supabase email/password (PKCE flow via `@supabase/ssr` v0.12.0)
- **Data:** DexScreener API proxied through Next.js API routes (server-side, avoids CORS)
- **Storage:** Portfolio uses Supabase `portfolio_tokens` table when logged in; falls back to `slt_portfolio` localStorage when not

### App structure (`app/`)

```
app/
├── app/
│   ├── api/
│   │   ├── dexscreener/route.ts          ← GET /api/dexscreener?address=
│   │   ├── dexscreener/trending/route.ts ← GET /api/dexscreener/trending
│   │   └── dexscreener/search/route.ts   ← GET /api/dexscreener/search?q=
│   ├── auditor/
│   │   ├── page.tsx                      ← Suspense wrapper
│   │   └── AuditorClient.tsx             ← Full audit tab ('use client')
│   ├── livelp/
│   │   ├── page.tsx
│   │   └── LiveLPClient.tsx              ← LP decision tool ('use client')
│   ├── discover/
│   │   ├── page.tsx
│   │   └── DiscoverClient.tsx            ← Trending feed + search ('use client')
│   ├── architect/
│   │   ├── page.tsx
│   │   └── ArchitectClient.tsx           ← Architecture designer ('use client')
│   ├── portfolio/
│   │   ├── page.tsx                      ← Server component (Supabase auth + data fetch)
│   │   └── PortfolioClient.tsx           ← Portfolio dashboard ('use client')
│   ├── login/                            ← Supabase auth page
│   ├── auth/callback/                    ← PKCE callback handler
│   ├── layout.tsx                        ← Nav bar with all 5 tabs
│   └── globals.css                       ← All shared CSS (dark terminal aesthetic)
├── lib/
│   ├── auditor/
│   │   ├── format.ts      ← fmt(), fmtD()
│   │   ├── classify.ts    ← classifyStage(), sc(), getShape(), getRW(), getMig(),
│   │   │                     getTLP(), objConfig(), getBinConfig()
│   │   ├── pools.ts       ← detectPoolType(), poolLinks(), buildPoolRows()
│   │   ├── scores.ts      ← estSlippage(), calcFragScore(), calcRoutingScore()
│   │   ├── chart.ts       ← buildDonutChart()
│   │   ├── risk.ts        ← buildRiskSection()
│   │   ├── microcap.ts    ← buildMicroCapSection(), buildMicroCapTable()
│   │   ├── ownership.ts   ← solRpc(), loadLPOwnershipSection(),
│   │   │                     buildLPOwnershipHTML()
│   │   └── analysis.ts    ← auditAnalysis() — 4 specialist voices per objective
│   ├── livelp/
│   │   └── decision.ts    ← computeMetrics(), computeLPDecision()
│   ├── discover/
│   │   └── render.ts      ← renderDiscCard(), renderDiscGrid(), getDiscVal(),
│   │                         getDiscTimeLabel()
│   └── architect/
│       └── plan.ts        ← buildDeployPlan(), buildMigSteps(), lifecycle(),
│                             archAnalysis()
└── proxy.ts               ← Next.js middleware (named 'proxy', guards env vars)
```

### What each tab does

**Auditor** (`/auditor`)
- Input: Solana token mint address + optimization objective (fee/stability/volume/balanced)
- Fetches live pool data via `/api/dexscreener`
- Outputs: risk filter, metrics row, collapsible details, TVL donut chart, allocation bar, slippage estimator, fragmentation score, routing dominance score, pool inventory table, LP ownership section (async, DAMM pools only), micro-cap IL comparison (sub-$40K), 4-paragraph specialist analysis
- Export: Markdown download, CSV pool data, Print/PDF
- Cross-navigation: `→ Live LP` button passes addr via `router.push('/livelp?addr=...')`

**Live LP** (`/livelp`)
- Input: token address, capital ($), risk (Conservative/Moderate/Aggressive), horizon (Days/Weeks/Months), goal (Maximize PnL/Generate yield/Support the token/Speculate)
- Full 8-branch decision tree across all MC tiers (sub-$5K → $500K+)
- Outputs: decision card with rationale, recommended config, expected outcomes, risk flags, watch list, pool inventory
- Cross-navigation: `→ Full Audit` button; receives `?addr=` param from Auditor/Discover

**Discover** (`/discover`)
- Trending feed via `/api/dexscreener/trending` (DexScreener token-boosts top, batch pair fetch)
- Volume mode and MC Change mode × 4 timeframes (1h / ~4h / ~12h / 24h)
- Search bar: ticker, name, or contract address via `/api/dexscreener/search`
- Each card: ⊕ Audit → `/auditor`, ⚡ Live LP → `/livelp`, + Portfolio → localStorage
- "← Trending" restores feed after search

**Architect** (`/architect`)
- Input form: supply, FDV, MC, capital, treasury %, LP %, growth targets (30/90/180/365d), vol, volatility, B/S ratio, holders, top-10 concentration, optimization objective
- Outputs: metrics row, stage badge, allocation bar (DAMM/DLMM/CLMM/reserve), deployment plan table, migration roadmap, lifecycle capital plan, 4-paragraph analysis
- No API calls — pure rules engine, runs synchronously on form submit

**Portfolio** (`/portfolio`)
- Supabase-backed when logged in; localStorage fallback when not. No redirect — works for both auth states.
- Per-token live data via `/api/dexscreener` proxy; health score, alerts, tag cycling, sort, filter, remove.
- Import banner syncs unsynced localStorage tokens to Supabase on first login.
- Token name click navigates to Auditor.

### Key architectural patterns

- **HTML string rendering:** All tab output is assembled as HTML strings by lib functions and rendered via `dangerouslySetInnerHTML`. This preserves 100% of the original logic and avoids rewriting the complex output templates as JSX.
- **`window._dynamo` object:** Interactive onclick handlers inside HTML strings (e.g., export buttons, micro-cap capital toggle, LP ownership expand, Discover card actions) call functions exposed on `window._dynamo` via `useEffect`.
- **`useSearchParams` + Suspense:** Every client component that reads `?addr=` is wrapped in `<Suspense>` in its `page.tsx`.
- **Cross-tab navigation:** `router.push('/tab?addr=...')` from any tab; receiving tab reads `useSearchParams().get('addr')` and auto-runs on mount.
- **Async LP fill:** `runAudit` renders synchronously fast; a `useEffect` watching `outputHTML` finds `#audit-lp-section` in the DOM and fills it with `loadLPOwnershipSection(pairs)` asynchronously.
- **DexScreener proxy:** All DexScreener fetches go through `/api/dexscreener*` routes (30–60s revalidate cache) to avoid CORS issues in production.

---

## Product Vision

### Tab structure (target)

```
[ Discover ] [ Live LP ] [ Auditor ] [ Portfolio ] [ Architect ]
```

Discover is the entry point for token discovery. Live LP and Auditor are the primary analysis tools. Portfolio is the home base. Architect is secondary but important.

---

### Tab 1: Auditor (enhanced)

**Purpose:** Deep audit of any token's existing liquidity structure. Answer: *how is this token's liquidity set up, is it healthy, and what should change?*

**Inputs:** Token mint address + optimization objective

**Objectives must produce fundamentally different strategies, not surface variations:**

#### Fee Generation objective
Full strategy: concentrate capital into the tightest viable DLMM bins around current price. Accept high rebalancing frequency as a cost of doing business. Prioritize fee density over stability. Recommend specific bin step sizes. Calculate realistic fee yield projections. Flag when volume is too low to justify concentration — in that case, explicitly say fee generation is not viable yet and recommend switching objective.

#### Price Stability objective
Full strategy: DAMM as a permanent full-range backstop is non-negotiable. DLMM in a Curve or Bid Ask shape at a wide enough range that it survives 2–3 standard deviation moves without going out of range. Explicitly de-prioritize fee yield — the goal is a price floor and consistent bid. Recommend reserve sizing. Flag manipulation risk from whale concentration. Discuss how treasury-owned liquidity stabilizes reflexivity.

#### Volume Growth objective
Full strategy: this is a routing game. Jupiter routes based on depth and slippage for a given trade size. The entire strategy is about winning the route for this token's typical trade size. Calculate what depth is needed to win Jupiter routing. Recommend consolidating into one dominant pool rather than spreading. Explain why fragmentation kills routing. Identify which DEX gives best routing exposure at this market cap.

#### Balanced objective
Full strategy: explicit portfolio theory applied to liquidity. Size DAMM as the defensive allocation (full-range protection), DLMM as the yield allocation (fee generation), reserve as the tactical allocation (migration capital). Give explicit percentage targets per component. Explain the tradeoffs explicitly — not just "this balances things" but *why* each allocation is sized the way it is.

**Each objective should read like it was written by a specialist in that strategy, not a generalist hedging all directions.**

**Additional Auditor outputs to build:**
- Slippage estimator: for a given trade size ($500 / $1k / $5k / $10k), what is the estimated price impact?
- Pool fragmentation score with explanation
- Routing dominance score (is this token winning its Jupiter route?)
- Treasury ownership analysis (what % of TVL is protocol-owned vs external LPs?)
- IL exposure estimate per pool type
- Historical liquidity health (if data available)

---

### Tab 2: Live LP

**Purpose:** Personal LP decision tool. Answer: *given where this token is right now, should I LP it, and if so exactly how?*

This is fundamentally different from the Auditor. The Auditor analyzes the token's liquidity from a protocol/treasury perspective. Live LP answers the question from a personal capital allocation perspective.

**The decision tree:**

```
Should I LP this token?
├── No action — price at a level where buying spot gives better risk/reward
├── Spot buy only — liquidity too thin or price momentum too strong for LP
├── DAMM / Full-range AMM — best for tokens with high upside uncertainty
│   └── Captures full price appreciation with no range risk
│   └── Lower fees but no IL from range exits
├── Wide DLMM — balanced approach
│   └── Some fee capture, survives moderate volatility
│   └── Acceptable IL, lower rebalancing burden
├── Tight DLMM — fee maximization
│   └── Only viable if volume/TVL ratio justifies it
│   └── High rebalancing cost, high IL risk on moves
├── No LP — better opportunities elsewhere or risk too high
└── Custom — edge case recommendations (e.g., single-sided, skewed position)
```

**Inputs:**
- Token mint address (pulls live data)
- Your capital to deploy ($)
- Your risk tolerance (Conservative / Moderate / Aggressive)
- Your time horizon (Days / Weeks / Months)
- Your primary goal (Maximize PnL / Generate yield / Support the token / Speculate)

**Output:**
- Clear recommendation: one of the above decision tree outcomes
- Detailed rationale: exactly why this recommendation was made for this specific token at this specific price/MC/vol
- If LP is recommended: exact configuration (pool type, DEX, shape, range width, bin step, entry size)
- Expected outcomes: projected fee yield, IL exposure, break-even volume needed
- Risk flags: what would invalidate this recommendation
- What to watch: specific metrics to monitor, when to exit or rebalance

**This should feel like getting advice from someone who deeply understands both the token's liquidity structure and personal LP mechanics — not a generic LP calculator.**

**Note: Live LP is an input-only page — no discovery feed. The Discover tab is the sole entry point for token discovery. Live LP and Auditor are analysis pages only.**

---

### Tab 3: Portfolio

**Purpose:** Track multiple tokens in one dashboard. Requires user auth so portfolio persists across devices/sessions for the team.

**Auth approach:** Simple email + password via Supabase (free tier). No OAuth complexity needed for an internal team tool.

**Per token card shows:**
- Name, symbol, stage badge
- Price + 24h change (color coded)
- MC, TVL, liq ratio (color coded: red <2%, amber <5%, green ≥5%)
- Est. daily fees
- Pool count + dominant pool type
- Quick health score (0–100)
- One-line alert if anything needs attention (e.g., "Price may have exited DLMM range", "Liq ratio critically low")

**Portfolio-level summary:**
- Total TVL across all tracked tokens
- Combined est. daily fees
- Count by stage
- List of tokens needing attention

**Click any card → full Auditor view for that token**

---

### Tab 4: Architect

**Purpose:** Design liquidity architecture for a token that doesn't exist yet or is pre-launch. Stays largely as-is from v0.1 but with dollar-specific outputs and deeper objective-tuned recommendations.

**Known improvements needed:**
- Objective selector (same 4 as Auditor) — each should produce fundamentally different architecture
- More specific bin step recommendations (actual Meteora bin step numbers: 1, 2, 5, 10, 20, etc.)
- Pool creation checklist output (step-by-step what to actually do on Meteora/Orca)
- Integration with real Meteora bin step data when backend exists

---

## Tech Stack (target)

### Current (v0.1)
- Pure HTML/CSS/JS, single file
- DexScreener public API (no key)
- Jupiter Price API v2 (no key)
- localStorage for portfolio

### Current (v1.0 — Next.js on Vercel) ✓

**Frontend**
- Next.js 16.2.9 (App Router, Turbopack)
- TypeScript (strict)
- CSS via `globals.css` (no Tailwind — plain CSS in dark terminal aesthetic)
- No component library — all UI is custom HTML string templates

**Backend / Data**
- Next.js API routes (Vercel serverless functions)
- Supabase `@supabase/ssr` v0.12.0 — auth only (email/password, PKCE flow)
- DexScreener API (pool data, trending, search) — no key, proxied server-side
- Solana public RPC `api.mainnet-beta.solana.com` — client-side only (LP ownership section)
- Meteora AMM API `amm-v2.meteora.ag` — client-side (LP mint resolution)

**Infrastructure**
- Vercel (hosting + serverless)
- Supabase (auth + Postgres DB — portfolio table exists but not yet wired to UI)

### Target additions (Phase 3 remaining)

### Data models (Supabase)

```sql
-- users (handled by Supabase Auth)

-- portfolios
create table portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  token_address text not null,
  label text,
  notes text,
  added_at timestamptz default now(),
  chain text default 'solana'
);

-- audit_cache (avoid re-fetching same token repeatedly)
create table audit_cache (
  token_address text primary key,
  chain text default 'solana',
  data jsonb,
  fetched_at timestamptz default now()
);

-- audit_snapshots (historical record for backtesting later)
create table audit_snapshots (
  id uuid primary key default gen_random_uuid(),
  token_address text,
  chain text default 'solana',
  snapshot jsonb,
  created_at timestamptz default now()
);
```

---

## Roadmap

### Phase 1 — Static HTML (v0.1) ✓
- [x] Auditor with live DexScreener data
- [x] Pool type detection and links
- [x] TVL donut chart
- [x] Optimization objectives (4)
- [x] Rules-based written analysis
- [x] Architect with dollar-specific deployment plan
- [x] Portfolio tracker (localStorage)
- [x] PDF/Markdown/CSV export

### Phase 2 — Quality pass (static HTML) ✓
- [x] Fundamentally differentiated objective strategies (4 specialist voices)
- [x] Live LP tab with 8-branch decision tree
- [x] Slippage estimator in Auditor
- [x] Pool fragmentation score (HHI-based)
- [x] Routing dominance score (3-factor)
- [x] Architect objective differentiation
- [x] Discover tab with trending + search + timeframe modes
- [x] Portfolio health scores, alerts, sort/filter, tags
- [x] MC-aware bin step config (`getBinConfig`)
- [x] Sub-$40K micro-cap IL comparison table
- [x] Rug/pass risk filter (8 signals, 0–100 score)
- [x] LP ownership concentration (DAMM pools, lock escrow detection)
- [x] Cross-navigation buttons (Auditor ↔ Live LP)
- [x] UI declutter, collapsible details row

### Phase 3 — Next.js migration (v1.0) ✓
- [x] Next.js 16 App Router + TypeScript
- [x] Supabase auth (email/password, PKCE, SSR)
- [x] Vercel deployment working
- [x] DexScreener API proxied server-side (CORS fix + 30s cache)
- [x] Auditor fully migrated (all lib modules + AuditorClient)
- [x] Live LP fully migrated (decision tree + LiveLPClient)
- [x] Discover fully migrated (trending API route, search API route, DiscoverClient)
- [x] Architect fully migrated (plan lib + ArchitectClient)
- [x] Portfolio tab migration (localStorage → Supabase `portfolio_tokens` table, with localStorage fallback)
- [ ] Helius RPC integration (holder counts, mint/freeze authority) — **also unblocks Live bin utilization** (see Phase 4 note)
- [ ] Birdeye integration (historical OHLCV and volume trends)
- [x] Multi-chain scaffold (ETH/Base ready, Solana active) — Session 12

### Phase 4 — Intelligence layer
- [ ] Backtesting engine: ingest historical Solana token data, answer questions like:
  - Which DLMM distributions worked best between $100k–$1M MC?
  - What liq/MC ratios correlate with sustainable growth?
  - At what stage should DAMM typically migrate to DLMM?
- [ ] Live bin utilization — **blocked: the key-free `dlmm-api.meteora.ag` REST API is decommissioned (origin 404s every path, cache-bust confirmed, 2026-06-16).** Per-bin data now requires the on-chain `@meteora-ag/dlmm` SDK via a real RPC (public RPC blocks `getProgramAccounts` on Meteora programs — see Session 7) or a paid provider (Bitquery). **Bundle with the Helius integration above.**
- [ ] Automated alert system (email or webhook when token needs attention)
- [ ] LP performance tracker (track actual positions, not just tokens)

### Phase 5 — Scale
- [ ] Public-facing version (if decided)
- [ ] Team collaboration features
- [ ] Custom report branding
- [ ] API access for programmatic audits

---

## Liquidity Framework Reference

This is the core mental model the entire platform is built on. All recommendations must be consistent with this framework.

### The reflexive loop
```
Liquidity → price impact → volume → fees → liquidity
```
Liquidity is not a yield product. It is a market structure control system.

### Pool type hierarchy

| Type | Best for | Strength | Weakness |
|------|----------|----------|----------|
| DAMM | Stage 0–1, unknown fair value | Full upside capture, no range risk | Capital inefficient |
| DLMM | Stage 1–4, structured markets | Fee density, adaptive distribution | Range exit = dead bins |
| CLMM | Stage 3–5, established ranges | High efficiency, institutional routing | Requires active management |

### Stage classification

| Stage | MC Range | Label | Primary pool mix |
|-------|----------|-------|-----------------|
| 0 | < $50K | Launch | 90% DAMM / 10% DLMM |
| 1 | $50K–$250K | Discovery | 60% DAMM / 40% DLMM |
| 2 | $250K–$1M | Emerging | 25% DAMM / 75% DLMM |
| 3 | $1M–$5M | Growth | 5% DAMM / 90% DLMM / 5% CLMM |
| 4 | $5M–$20M | Established | 70% DLMM / 30% CLMM |
| 5 | > $20M | Institutional | 40% DLMM / 60% CLMM |

### DLMM shape selection

| Shape | Use when |
|-------|----------|
| Spot | Stable price, fee maximization |
| Curve | Low volatility, deep midpoint concentration |
| Bid Ask | High volatility, two-sided depth |
| Skewed Bullish | B/S ratio > 1.4, bullish momentum |
| Skewed Bearish | B/S ratio < 0.8, selling pressure |
| Multi Range | Extreme volatility, narrative-driven price |

### Migration triggers

| From stage | Trigger |
|-----------|---------|
| 0 → 1 | MC > $50K or vol > $5K/day |
| 1 → 2 | MC > $250K or 3x vol spike |
| 2 → 3 | MC > $1M, bin utilization > 80% |
| 3 → 4 | MC > $5M, introduce CLMM layer |
| 4 → 5 | Route optimization, expand CLMM |

### Key derived metrics

```
Liquidity Efficiency (LE) = Volume / Active Liquidity
Fee Density (FD) = Fees / Liquidity
Liquidity Velocity (LV) = Volume / Liquidity
Concentration Risk Index (CRI) = Top 10 Holder %
Treasury Liquidity Exposure (TLE) = Treasury Liquidity / Total Supply
```

### Optimization objective strategies (detailed)

#### Fee Generation
- Concentrate into tightest viable DLMM bins
- Spot or Curve shape only
- Bin step: 1–5 (tightest)
- Reserve: 15% (rebalancing fund)
- Target fee density: > 0.1% daily
- Not viable if Vol/Liq < 0.5x — say so explicitly, recommend switching objective
- Weekly rebalancing cadence minimum

#### Price Stability
- DAMM as permanent full-range backstop (non-negotiable)
- DLMM in Bid Ask or Curve at ±30–50% range
- Reserve: 25% (emergency deployment)
- De-prioritize fee yield explicitly
- Recommend CRI monitoring — high concentration = manipulation risk
- Discuss reflexivity: treasury-owned liquidity stabilizes price feedback loops

#### Volume Growth
- Win the Jupiter route — this is the entire strategy
- One dominant pool > multiple fragmented pools
- Depth at current price > range width
- Target slippage < 0.5% for median trade size at this MC
- Add second DEX for routing path diversity at Stage 3+
- Fragmentation analysis is the centerpiece recommendation

#### Balanced
- DAMM = defensive allocation (full-range floor)
- DLMM = yield allocation (fee capture)
- Reserve = tactical allocation (migration + opportunity)
- Explicit sizing rationale per component
- Not "a little of everything" — a deliberate portfolio theory approach

---

## Development Conventions (for Claude Code)

### Repository layout
- `index.html` — static HTML reference build (v0.2, do not edit)
- `app/` — the active Next.js application (all development goes here)
- `CLAUDE.md` — this file (update the Session Log at the end of every session)

### Next.js patterns in this codebase
- **Never** use `'use client'` in a file that also does `async` data fetching — keep server/client boundary clean
- All client components that use `useSearchParams` must be wrapped in `<Suspense>` in the parent `page.tsx`
- `window._dynamo` is the bridge between HTML string onclick attributes and React state — expose new interactive functions there in `useEffect`
- HTML string lib functions live in `lib/`; they return strings, have no React dependencies, and are pure TypeScript
- The middleware file is `proxy.ts` (not `middleware.ts`) — the function inside is named `proxy`
- `next.config.ts` has `output: 'standalone'` and no `rootDirectory` override — Vercel infers this correctly

### When working on recommendations/analysis
- Each optimization objective must read like a different specialist wrote it
- Never hedge all directions in a single objective — commit to the strategy
- Dollar amounts always over percentages where capital is known
- Every recommendation must include: what to do, why, what success looks like, what would invalidate it

### When working on the frontend
- Dark terminal aesthetic for the app UI (background `#0a0a0a`, text `#e8e8e6`)
- White professional layout for PDF exports only
- Pool type colors are fixed: DAMM=#1D9E75, DLMM=#378ADD, CLMM=#D85A30, CPMM=#7F77DD
- Stage colors: 0=#888780, 1=#1D9E75, 2=#378ADD, 3=#BA7517, 4=#D85A30, 5=#993556
- All CSS lives in `app/globals.css` — no Tailwind, no CSS modules

### API notes
- DexScreener tokens: `/api/dexscreener?address=` — proxied, 30s revalidate
- DexScreener trending: `/api/dexscreener/trending` — proxied, 60s boosts / 30s pairs
- DexScreener search: `/api/dexscreener/search?q=` — proxied, no cache
- Solana RPC: `https://api.mainnet-beta.solana.com` — called client-side directly (CORS open)
- Meteora AMM API: `https://amm-v2.meteora.ag/pools?address={addr}` — called client-side (no key)
- Helius: requires free API key — integrate in Phase 3 for holder counts, mint/freeze authority
- Birdeye: requires free API key — integrate in Phase 3 for historical OHLCV

### localStorage schema
- Key: `slt_portfolio`
- Value: `Array<{ address, name, symbol, mc, tvl, vol24, liqRatio, priceChg, stage, stageLabel, loading?, tag? }>`
- Written by: Discover `+ Portfolio` button via `window._dynamo.addToPortfolio`
- Read by: Portfolio page (migration pending)

### Multi-chain scaffold
- All token objects must carry a `chain` field defaulting to `'solana'`
- Stage classification logic is chain-agnostic (based on MC thresholds)
- Pool type detection must be chain-aware when ETH/Base support added
- Address validation differs per chain — abstract into a `validateAddress(addr, chain)` helper

---

## Session Log

### Session 1 (initial build)
- Built static HTML terminal with Auditor + Architect tabs
- DexScreener integration for live pool data
- Rules-based stage classification and recommendation engine
- Basic written analysis per optimization objective

### Session 2 (feature additions)
- Pool type detection (DLMM/DAMM/CLMM/CPMM) with color badges
- Pool links (DexScreener, Solscan, native DEX UI)
- TVL donut chart by pool type group
- Portfolio tab with localStorage persistence
- Export: Markdown, CSV, professional 3-page PDF
- Dollar-specific deployment plan in Architect
- Migration roadmap with step-by-step triggers

### Session 3 (Phase 2 — quality pass, complete)

**2A — Objective differentiation**
- Rewrote `auditAnalysis()` and `archAnalysis()` from scratch — 4 distinct specialist voices per objective
- Fee: vol/liq viability gate, fee density math, rebalancing cadence
- Stability: DAMM non-negotiable, reflexivity loop, migration holdback warning
- Volume: Jupiter routing framing, median trade size by MC tier, single-pool mandate
- Balanced: portfolio theory (DAMM=defense, DLMM=yield, reserve=tactical)
- `objConfig()` updated with specific range adjustments, reservePct, dlmmBias per objective

**2B — Live LP tab**
- New tab (between Auditor and Discover) with 7-branch decision tree
- Inputs: token address, capital, risk tolerance, time horizon, primary goal
- Decision branches: No Action / Spot Buy / DAMM / Wide DLMM / Tight DLMM / No LP / Custom
- Styled recommendation card with badge, metric row, config block, expected outcomes, risk flags, watch list

**2C — Auditor depth additions**
- Slippage estimator: $500 / $1K / $5K / $10K trade impact using pool-type concentration model
- Fragmentation score 0–100 (HHI-based): Healthy / Moderate / Fragmented / Severely Fragmented
- Routing dominance score 0–100 (3-factor: depth vs. target, fragmentation, DEX venue)

**2D — Architect improvements**
- Added objective selector scoped to Architect tab (`setArchObj`, `archObjective` global)
- Deployment plan and written analysis respond to objective selection

**2E — Portfolio improvements**
- `calcHealthScore(t)`: 5-factor 0–100 composite (liq ratio, vol/liq, price stability, fragmentation, stage)
- `getPortfolioAlert(t, hs)`: 6 trigger conditions — liq ratio <2% (red), health <40 (red), ±20% price change (amber), pools >8 (amber), stage 0 + vol/liq <0.1 (amber)
- Health bar + alert rendered on every portfolio card

**2F — Discover tab**
- New tab (between Auditor and Live LP); lazy-loaded on first visit
- Trending feed from DexScreener `token-boosts/top/v1`, batch-fetched pair data
- Search bar: accepts ticker, name, or contract address via DexScreener search endpoint
- Results replace trending grid; "Back to trending" restores cached HTML
- `discoverLoaded` + `discTrendingHTML` globals prevent duplicate fetches

**2G — DLMM bin step overhaul**
- `getBinConfig(mc, obj)`: MC-aware bin config replacing all static bin step references
- Sub-$500K: wide bins (250–400 bps) + high fees (2–4%); $500K–$5M: mid (80–200 bps) + 0.5–2%; $5M+: tight (25–100 bps) + 0.25–1%
- All 10+ call sites across Auditor, Architect, Live LP, and analysis text updated
- `objConfig()` `binStep` field removed

**2H — Sub-$40K MC decision logic**
- `buildMicroCapSection(mc, volLiq, tvl)` / `buildMicroCapTable(mc, volLiq, tvl, ref)` in Auditor
- DAMM vs Spot IL math at $100K / $250K / $1M MC milestones; daily fees, break-even days
- Capital toggle $100 / $250 / $500 / $1K re-renders table in place via `microCapParams` global
- Recommendation logic by vol/liq tier

**2I — Rug / pass filter**
- `buildRiskSection(mc, fdv, tvl, vol24, liqRatio, volLiq, priceChg, pairs)` at top of every Auditor output
- Multi-factor risk score 0–100; verdicts: Pass / Caution / High Risk / Do Not Touch
- 8 risk signals + 2 green signals; 3 on-chain stubs (mint/freeze authority, LP lock)
- Flags sorted red → amber → green → stubs with score pts and per-flag rationale

**Next: Phase 2 continued (2J–2P) — see Session 4**

### Session 4 (Phase 2 continued — planning, 2026-06-09)

Planned 2J–2P improvements before Phase 3 migration. All items documented in ROADMAP.md. No code changes this session.

**2J — Tab reorder**
- New tab order: Discover → Live LP → Auditor → Portfolio → Architect
- Update tab bar HTML only

**2K — Discover card Live LP button**
- Third action button on every Discover card alongside Audit and Add to Portfolio
- One-click pre-fills Live LP form and runs analysis

**2L — Portfolio sort and scale**
- Token limit raised to 50 (cap 100)
- Sort controls: highest stage (default), lowest stage, highest liq ratio, worst health score, alphabetical
- Optional tags per token: watching / active LP / research / other
- Filter by tag

**2M — Live LP trending feed**
- Trending section at top of Live LP tab (before analysis form)
- Volume mode and MC Change mode with 1h / 4h / 12h / 24h time selectors
- DexScreener priceChange fields; 4h/12h estimated from available data
- Clicking token pre-fills Live LP form and auto-runs analysis

**2N — Live LP lowcap decision tree refinement**
- Sub-$5K MC: Pass or DAMM + Spot (DAMM can compound to strong valuation at this range; spot provides clean upside)
- $5K–$40K: existing 2H micro-cap logic
- $40K–$150K: wide DLMM (Bid Ask, bin step 300–400) + spot hedge
- $150K–$500K: DLMM-only, two paths: range-bound → Medium DLMM; trending/volatile → Wide DLMM. No DAMM, no reserve in Tier D.
- $500K+: existing logic unchanged

**2O — UI declutter**
- Compact metric cards into tighter single row
- Smaller section labels
- Collapsible details row for FDV / pool count / volatility
- Tighten spacing throughout; critical numbers visible without scrolling

**2P — LP ownership concentration via Solscan**
- New collapsible section in Auditor below pool inventory
- Per pool: unique LP wallet count, top 3 wallet shares
- Expanded: wallet addresses, deposit amounts, timestamps, withdrawal status
- Solscan transaction API; flag if top 3 > 60% of pool liquidity
- Stub for Helius upgrade in Phase 3

### Session 5 corrections
- Sub-$5K recommendation corrected from "Pass or spot only" to "Pass or DAMM + Spot — DAMM can compound strongly at this range; spot provides clean upside exposure alongside it"

### Session 5 (Phase 2 build — 2J through 2O, 2026-06-09)

All items planned in Session 4 built in order. 2P not yet started.

**2J — Tab reorder ✓**
- Tab bar reordered to: Discover → Live LP → Auditor → Portfolio → Architect
- `panel-discover` is now the default active panel; HTML-only change

**2K — Discover card Live LP button ✓**
- Third action button "⚡ Live LP" added to every `renderDiscCard` output
- `openLiveLPFromDiscover(addr)`: writes address to `lp-addr`, switches tab, calls `runLiveLP()`

**2L — Portfolio sort, scale, and tags ✓**
- Token limit raised from 10 → 50
- Sort controls: Stage ↓ (default) / Stage ↑ / Liq Ratio / Worst Health / A–Z
- `portSort` + `portFilter` globals; `setPortSort()` / `setPortFilter()` update state and re-render
- Tag system: `PORT_TAGS` object, `TAG_CYCLE` array; tag stored on token object in localStorage
- Tag badge on every card; clicking cycles null → watching → active-lp → research → other
- Filter row above sort row: All / Watching / Active LP / Research / Other

**2M — Live LP trending feed ✓**
- Trending section rendered at top of Live LP panel before the analysis form
- Two modes: Volume (default) and MC Change with 1h / ~4h / ~12h / 24h time selectors
- 4h estimated as `h6×(4/6)`, 12h estimated as `(h6+h24)/2`; labeled "~4h" / "~12h" in UI
- Reuses DexScreener token-boosts endpoint + pair batch fetch from Discover; `lpTrendData` cache
- `openLiveLPFromTrend(addr)`: writes address, hides trending section, runs `runLiveLP()`
- `onLPAddrInput()`: hides trending section when user manually types an address
- `switchTab('livelp')` triggers `runLPTrending()` on first visit; `lpTrendLoaded` prevents duplicate fetches

**2N — Live LP lowcap decision tree ✓**
- MC < $5K: vol24 < $200 → Pass; else → DAMM + Spot (60/40 split)
- $5K–$40K: standalone DAMM/Spot rationale text; no buildMicroCapSection embed (kept clean)
- $40K–$150K: Wide DLMM (Bid Ask, bin step 300–400) + 25–35% spot hedge
- $150K–$500K (Tier D, corrected after review): DLMM-only, no DAMM, no reserve
  - `rangebound = |priceChg| ≤ 15% AND vola ∈ {Low, Medium}` → Medium DLMM (Curve/Spot, ±15–20%)
  - else → Wide DLMM (Bid Ask, bin step 200–300, ±35–40%)
  - Reserve removed from Tier D — reserve is an Architect/protocol concept, not a personal LP position
- $500K+: existing logic unchanged

**2O — UI declutter ✓**
- Step 1 (CSS): reduced panel padding 20px→16px; section label font/spacing tightened; `.igrid`, `.rbtn`, `.obj-row`, `.out`, `.mrow`, `.mc2`, `.pool-wrap`, `.analysis`, `.analysis p`, `.disc-card`, `.disc-header`, `.disc-sym`, `.disc-name`, `.disc-price`, `.disc-metrics` — all padding/font/margin reduced
- Step 2 (collapsible details row): inserted directly below `.mrow` in Auditor output
  - Collapsed: `▸ FDV $X · N pools · Vola volatility · 0.003% fee density` (clickable)
  - Expanded: 4 labeled mini-cells (FDV / Pools / Volatility / Fee Density) matching mc2 card style
  - Toggle uses `this.nextElementSibling` — no global function, no ID needed
  - Fee density sub-label removed from Est. Daily Fees mc2 card
  - Secondary info span removed from stage badge row (pools/volatility/FDV now only in collapsible)

**Next: 2P — LP ownership concentration via Solscan**

### Session 6 (Phase 2 fixes — complete, 2026-06-09)

**(a) Trending feed removed from Live LP ✓** — Removed `lp-trending-section` HTML block, `runLPTrending`, `renderLPTrendGrid`, `setLPTrendMode`, `setLPTrendTime`, `renderLPTrendCard`, `openLiveLPFromTrend`, `onLPAddrInput`, `getLPTrendChg`, `getLPTrendChgLabel` functions, four `lpTrend*` state vars, `oninput` on `lp-addr`, and `runLPTrending()` call from `switchTab`. Live LP is now input-only.

**(b) Discover timeframe filter on both modes ✓** — Added Volume / MC Change mode buttons + 1h / ~4h / ~12h / 24h time selectors to Discover panel. `runDiscover` now captures `volH1`, `volH6`, `priceH1`, `priceH6` per token (highest-vol pair for price, summed for vol). New functions: `getDiscVal(t)`, `getDiscLabel()`, `renderDiscGrid()`, `setDiscMode(mode, el)`, `setDiscTime(t, el)`. `discTrendingHTML` replaced by `discTokenData` + `renderDiscGrid()` for search restore.

**(c) Pool inventory table added to Live LP output ✓** — `buildPoolRows(pairs)` appended to `out.innerHTML` in `runLiveLP`, with a `<div class="sl">Pool inventory</div>` label and same `pool-wrap` / `ph` header structure as Auditor. `pairs` was already in scope.

**(d) TVL donut chart confirmed in Auditor ✓** — `buildDonutChart(pairs, tvl)` was already correctly in place at line 1950 and rendered at line 2035–2036. No code change needed; confirmed intact.

**(e) Cross-navigation buttons ✓** — Added `lastLPAddr` and `lastAuditAddr` globals (init `''`). `runLiveLP` stores `addr` to `lastLPAddr` before render; `runAudit` stores `addr` to `lastAuditAddr` after `lastAuditData`. Live LP output header: `→ Full Audit` button (export-btn style) writes `lastLPAddr` → `audit-addr`, switches to Auditor, calls `runAudit()`. Auditor output header: `→ Live LP` button (first in export-bar) writes `lastAuditAddr` → `lp-addr`, switches to Live LP, calls `runLiveLP()`.

### Session 7 (Phase 2 — 2P complete, 2026-06-10)

**Pre-build API research:** Investigated all candidate data sources for LP ownership concentration. Solscan v1 public API is dead (404 on all routes). Solscan v2 pro API requires a paid key (401). `getProgramAccounts` on Orca/Meteora programs is explicitly blocked on the Solana public RPC. `getTokenLargestAccounts` works on the public RPC in a browser context (rate-limited only under heavy scripted load). `amm-v2.meteora.ag/pools?address={addr}` returns full DAMM pool data including `lp_mint` with no key required. The original 2P spec (Solscan transaction API) was revised accordingly.

**Lock escrow research:** Meteora has no separate lock vault program. Lock escrows are PDAs derived from the Dynamic AMM program itself (`Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB`) using seeds `["lock_escrow", pool_pubkey, owner_pubkey]`. Detection method: resolve each LP token account's owner via `getMultipleAccounts`; if that owner account is itself owned by the AMM program ID, it is a lock escrow PDA.

**2P — LP ownership concentration ✓**

- `detectPoolType` patched: added `lbl.includes('dyn')` to DAMM detection so DYN/DYN2-labeled pools (newer Meteora DAMM naming) correctly resolve to `group:'Meteora DAMM'` instead of falling through to `Meteora AMM`
- Constants added: `METEORA_AMM_PROGRAM` and `SOLANA_RPC` at top of globals with explanatory comment
- `solRpc(method, params)` — thin async fetch wrapper for Solana JSON-RPC with 429/error handling
- `loadLPOwnershipSection(pairs)` — async function, called after `out.innerHTML` is set in `runAudit`; fills `<div id="audit-lp-section">` placeholder. Three paths:
  - **PumpSwap pools** (`group === 'PumpSwap'`): skipped entirely — bonding curve pools are always concentrated by design; shows a note, no analysis
  - **Meteora DAMM/DYN pools**: 4-step fetch per pool — (1) `amm-v2.meteora.ag` → `lp_mint`; (2) `getTokenSupply(lp_mint)` → total supply; (3) `getTokenLargestAccounts(lp_mint)` → top 20 token accounts; (4a) `getMultipleAccounts(tokenAccts, jsonParsed)` → resolve wallet owners; (4b) `getMultipleAccounts(owners, base64)` → identify lock escrow PDAs (owner of owner === AMM program). Flag `⚠ Concentrated Ownership` if top-3 unlocked wallets > 60% of total LP supply. Note shown: "Concentration calculated on unlocked LP only."
  - **DLMM / CLMM / all other types**: Phase 3 stub — "requires on-chain position account indexing; available with Helius in Phase 3"
- `buildLPOwnershipHTML(results, errors, hasPumpSwap, hasOtherTypes)` — pure render function; per-pool card with summary metrics (top-3 unlocked %, locked LP %, unlocked holder count) + collapsible holder list (rank, shortened address linked to Solscan, %, 🔒 Locked badge). Per-pool errors rendered inline without breaking other pools.
- Async load pattern: main `runAudit` render is synchronous and fast; LP section shows "Loading…" blink then fills in async. No blocking of audit output.

**Phase 2 complete.** All items 2A–2P done. Next: Phase 3 (Next.js migration).

### Session 8 (Phase 3 — scaffold + Auditor migration, 2026-06-10)

**Scaffold**
- `npx create-next-app@latest app` — Next.js 16, TypeScript, App Router, no Tailwind
- Supabase added: `@supabase/ssr` v0.12.0, `createBrowserClient` / `createServerClient`
- Auth: email/password login page (`/login`), PKCE callback handler (`/auth/callback`)
- `proxy.ts` middleware: guards Supabase env vars so all routes 200 without keys; function named `proxy` (Next.js 16 requires non-`middleware` export name)
- `vercel.json` at repo root with `framework: nextjs` only — no `rootDirectory` override (caused 404s when present)
- All 5 tab routes created as placeholder pages

**Auditor migration**
- `lib/auditor/format.ts` — `fmt()`, `fmtD()`
- `lib/auditor/classify.ts` — `classifyStage()`, `sc()`, `getShape()`, `getRW()`, `getMig()`, `getTLP()`, `objConfig()`, `getBinConfig()`
- `lib/auditor/pools.ts` — `detectPoolType()`, `poolLinks()`, `buildPoolRows()`
- `lib/auditor/scores.ts` — `estSlippage()`, `calcFragScore()`, `calcRoutingScore()`
- `lib/auditor/chart.ts` — `buildDonutChart()`
- `lib/auditor/risk.ts` — `buildRiskSection()`
- `lib/auditor/microcap.ts` — `buildMicroCapSection()`, `buildMicroCapTable()`
- `lib/auditor/ownership.ts` — `solRpc()`, `loadLPOwnershipSection()`, `buildLPOwnershipHTML()`
- `lib/auditor/analysis.ts` — `auditAnalysis()` (4 specialist voices)
- `app/api/dexscreener/route.ts` — GET proxy, 30s revalidate
- `app/auditor/AuditorClient.tsx` — full client component; `window._dynamo` exposes `setMicroCapRef`, `exportMarkdown`, `exportCSV`, `exportPrint`, `goToLiveLP`; async LP ownership fill via `useEffect` on `outputHTML`
- `app/auditor/page.tsx` — Suspense wrapper
- `app/globals.css` — all shared CSS classes added

**Vercel deployment lessons learned**

- **`rootDirectory` is not a valid `vercel.json` property.** Vercel's schema rejects it and the build fails with a validation error. Set the Root Directory in the Vercel dashboard (Project → Settings → General → Root Directory) instead. The `vercel.json` at the repo root should only contain `{ "framework": "nextjs" }` — nothing else.

- **Framework Preset must be set manually when Next.js is in a subdirectory.** Vercel auto-detects Next.js only when `package.json` is at the repo root. When the app lives in `app/`, open Project → Settings → General → Framework Preset and set it to Next.js explicitly, then set Root Directory to `app`. Without this, Vercel treats it as a static site and every route 404s.

- **`proxy.ts` middleware must guard missing Supabase env vars with an early `return NextResponse.next()`, never a throw.** If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are absent (e.g., a preview deployment with no env vars configured), throwing causes the middleware to crash and return 404 on every route — including the root `/`. The guard pattern:
  ```ts
  export function proxy(request: NextRequest) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.next();
    }
    // ... normal session refresh logic
  }
  ```

- **Auth callback must handle both PKCE (`?code=`) and token-hash (`?token_hash=&type=`) flows.** Supabase can send either depending on project config and client version. Magic links use token-hash; OAuth and email confirmation use PKCE. If the callback only handles `code`, token-hash logins fail silently with `auth_callback_failed`. Handle both:
  ```ts
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (token_hash && type) {
    await supabase.auth.verifyOtp({ token_hash, type });
  }
  ```

- **Supabase allowed redirect URLs must include the production Vercel URL before deploying.** Supabase blocks any redirect URL not on the allowlist — a localhost-only config causes `auth_callback_failed` in production with no clear error message. Add the production URL (e.g., `https://your-app.vercel.app/**`) in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs. Add new Vercel deployment URLs before sharing with the team.

### Session 9 (Phase 3 — Live LP + Discover + Architect migration, 2026-06-10)

**Live LP migration**
- `lib/livelp/decision.ts` — `computeMetrics()`, `computeLPDecision()`: full 8-branch decision tree (No LP / No action / Spot buy / Pass / DAMM+Spot / Wide DLMM+Spot / Medium DLMM / Wide DLMM / Tight DLMM / DAMM / default Wide DLMM) across all MC tiers
- `app/livelp/LiveLPClient.tsx` — client component; form with 5 inputs; fetches `/api/dexscreener`; `window._dynamo.goToAudit` for cross-navigation; pool inventory via `buildPoolRows`; `?addr=` auto-run from Auditor
- `app/livelp/page.tsx` — Suspense wrapper

**Discover migration**
- `app/api/dexscreener/trending/route.ts` — fetches token-boosts/top/v1, batch-fetches pairs, processes into `DiscToken[]`; 60s boosts cache, 30s pairs cache
- `app/api/dexscreener/search/route.ts` — proxies DexScreener search, returns sorted `DiscToken[]`
- `lib/discover/render.ts` — `renderDiscCard()`, `renderDiscGrid()`, `getDiscVal()`, `getDiscTimeLabel()`
- `app/discover/DiscoverClient.tsx` — trending loads on mount (once); mode/time are React state; grid HTML via `useMemo`; search shows results with `← Trending`; `window._dynamo.{openAudit, openLiveLP, addToPortfolio, refreshTrending, restoreDiscover}`; `addedAddresses` state synced to `slt_portfolio` localStorage

**Architect migration**
- `lib/architect/plan.ts` — `buildDeployPlan()`, `buildMigSteps()`, `lifecycle()`, `archAnalysis()` (all 4 objectives)
- `app/architect/ArchitectClient.tsx` — pure sync (no API calls); objective buttons are React state; `runArchitect()` reads form DOM values, calls lib functions, sets `outputHTML`
- `app/architect/page.tsx` — Suspense wrapper

**Build result after all 4 tabs:**
```
Route (app)
├ ○ /auditor
├ ○ /livelp
├ ○ /discover
├ ○ /architect
├ ƒ /api/dexscreener
├ ƒ /api/dexscreener/trending
├ ƒ /api/dexscreener/search
├ ƒ /auth/callback
├ ƒ /login
└ ƒ /portfolio  ← placeholder
```

**Phase 3 remaining: Portfolio tab migration** — read `slt_portfolio` from localStorage, add Supabase persistence, port health scores / alerts / sort / filter / tags, connect "+ Portfolio" from Discover to live portfolio page.

### Session 10 (Phase 3 — Portfolio tab migration, 2026-06-11)

**Portfolio tab fully migrated ✓**

- `app/portfolio/page.tsx` — server component; reads Supabase `portfolio_tokens` table when user is logged in; falls through to localStorage mode (no redirect) when unauthenticated or Supabase is unavailable. Passes `userId: string | null` to client.
- `app/portfolio/PortfolioClient.tsx` — complete implementation:
  - **Dual storage mode**: Supabase when `userId` is set; `slt_portfolio` + `slt_portfolio_meta` localStorage keys when not.
  - **localStorage helpers**: `lsRead`, `lsAddAddress`, `lsRemoveAddress`, `lsSetTag`, `lsBuildRows` — reads `address` from Discover's existing `slt_portfolio` entries; stores tags/added_at in separate `slt_portfolio_meta` key to avoid clobbering Discover's data.
  - **Live data fetch**: uses `/api/dexscreener?address=` proxy (fixed from direct DexScreener call).
  - **Sort options**: MC ↓, TVL ↓, Vol ↓, 24h Δ, Newest (loading entries always sort last).
  - **Filter**: All / Watching / Active LP / Research / Other.
  - **Tags**: click cycles null → watching → active-lp → research → other; persisted to Supabase or localStorage.
  - **Remove**: per-card remove button; deletes from Supabase or localStorage.
  - **Health score**: 5-factor 0–100 (liq ratio, vol/liq, price stability, stage, pool count); color-coded + mini health bar.
  - **Alerts**: liq ratio < 2% (red), health < 40 (red), ±20% price move (amber), > 8 pools (amber).
  - **Navigate to Auditor**: clicking token name pushes `/auditor?addr=...`.
  - **Sign-in banner**: shown when using localStorage mode with link to `/login?next=/portfolio`.
  - **Import banner**: shown when logged in and localStorage has tokens not yet in Supabase — "Import N" button bulk-inserts them.
  - **Add token**: mint address input; writes to Supabase or localStorage; fetches live data immediately.
  - Max 50 tokens enforced.

**Build result:**
```
└ ƒ /portfolio   ← dynamic (server-rendered on demand)
```
`npm run build` passes clean. TypeScript clean.

**Phase 3 complete.** All tabs migrated. Next: Phase 4 (intelligence layer) or Helius/Birdeye integrations.

### Session 11 (Simulator tab — LP growth projection, 2026-06-16)

New **Simulator** tab (6th, appended after Architect) projecting LP position value from **price appreciation only — no fees, no rebalancing** (static-position snapshot). Two pool types via a mode toggle.

**DAMM v2 — full-range constant product**
- `lib/simulator/damm.ts` — `simulateDamm({ tokenAmt, quoteAmt, entryMC, targetMCs })`.
- Value scales with √price: `V_final = V0·√(MC_final/MC0)`. `V0 = tokenAmt·P0 + quoteAmt` where implied `P0 = quoteAmt/tokenAmt` (balanced deposit → `V0 = 2·quoteAmt`). Position is always 50/50 by value, so no supply input needed.
- Output columns: MC | LP value | multiple | **vs. holding** (negative = IL vs hold, where `V_hold = quoteAmt·(1+ratio)`).

**DLMM — discrete bins (the deep model)**
- `lib/simulator/dlmm.ts` — `genBins()` (geometric, center price `b_k = low·(1+s)^(k+0.5)`, `s=binStep/10000`, capped at `MAX_BINS=2000`), `shapeWeights()` (spot=uniform, curve=peak-center, bidask=U-shape), `buildBins()`, `compositionAtPrice()`, `valueAtPrice()`, `simulateDlmm()`.
- Per-bin constant-sum conversion at `b_k`: base-side bin sells to quote once `pf ≥ b_k`; quote-side bin buys base once `pf ≤ b_k`. Sum → value at any price.
- **Structure toggle**: `two` (base above entry, quote below), `dca-out` (1-sided, 100% token, range above entry, sells up), `dca-in` (1-sided, 100% quote, range below entry, buys down). Client clamps current price to the near edge for 1-sided (`dca-out`: entry=min(entry,low); `dca-in`: entry=max(entry,high)) so entry value reconciles with deposit.
- Optional entry MC → `supply = entryMC/entryPrice` enables MC labels in the sweep.
- Output: deposit/entry/bottom/top metric row + price sweep table (price | MC | value | × | token qty | quote held) with inline `.abar` bars + written read-out (shape + structure + bin-step behavior).

**Files**: `app/simulator/{page.tsx,SimulatorClient.tsx}` (modeled on Architect — DOM-read inputs via `g(id)`, HTML string → `dangerouslySetInnerHTML`; mode/side/shape are React state). `lib/simulator/{damm,dlmm,render}.ts` (pure TS, reuse `fmt`/`fmtD`). `components/TabNav.tsx` — added Simulator tab. No new CSS; reuses `.obj-btn`/`.igrid`/`.dtable`/`.mrow`/`.analysis`/`.abar`. Toggle active state via inline style (no color sub-class dependency).

**Verified**: `npm run build` clean, `/simulator` static. Math sanity via `tsx`: DAMM ¼MC→0.5×, 2×MC→1.414×, 4×MC→2.0× with negative vs-hold; DLMM 2-sided entry≈deposit, bidask>spot>curve at both extremes; 1-sided entry reconciles with deposit after clamp.

**Scope (v1)**: no fees, no rebalancing, no time decay; DAMM v2 concentration not modeled; SOL quote shown in quote units (no SOL/USD drift). Candidates for v2.

### Session 12 (Multi-chain scaffold, 2026-06-16)

Foundational multi-chain plumbing (Phase 3 item). Solana stays active; Ethereum/Base are registered + validatable but not surfaced in UI or pool logic yet.

- `lib/chains.ts` — `Chain` type (`solana|ethereum|base`), `CHAINS` registry (`{ label, dexscreenerId, validate, addressHint, active }`), `validateAddress(addr, chain=DEFAULT_CHAIN)` (Solana base58 32–44; EVM `0x`+40 hex), `chainFromDexId()`, `ACTIVE_CHAINS`, `DEFAULT_CHAIN='solana'`.
- **Address validation wired into all 3 entry points**: `AuditorClient.runAudit`, `LiveLPClient.runLiveLP`, `PortfolioClient.addToken` — reject malformed input with `CHAINS.solana.addressHint` message before any fetch/insert.
- **`chain` field threaded through token objects** (per convention): `PortfolioRow.chain` (types.ts) set at every construction — `portfolio/page.tsx` (Supabase read defaults `'solana'`, no DB column needed), `lsBuildRows`, `sbAdd`, localStorage `addToken` path; `DiscToken.chain` set in both trending + search API routes; Auditor `lastAuditDataRef` carries `chain`; Discover `addToPortfolio` localStorage entry carries `chain`.
- Pool-type detection remains Solana-specific — flagged for chain-awareness when ETH/Base are activated (not done here).

**Verified**: `npm run build` clean; `tsx` unit check 7/7 (valid SOL mints, EVM addr on ethereum, EVM-on-solana rejected, garbage rejected; `chainFromDexId`/`ACTIVE_CHAINS` correct).
