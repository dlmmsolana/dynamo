'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { PortfolioEntry, PortfolioRow, Tag, TokenLive } from '@/lib/types';

// ── constants ─────────────────────────────────────────────────────────────────

const TAG_CYCLE: Tag[] = [null, 'watching', 'active-lp', 'research', 'other'];

const TAG_META: Record<NonNullable<Tag>, { label: string; color: string }> = {
  watching: { label: 'Watching', color: '#BA7517' },
  'active-lp': { label: 'Active LP', color: '#1D9E75' },
  research: { label: 'Research', color: '#378ADD' },
  other: { label: 'Other', color: '#7F77DD' },
};

const STAGE_COLORS = ['#888780', '#1D9E75', '#378ADD', '#BA7517', '#D85A30', '#993556'];

const SORT_OPTIONS = [
  { value: 'stage-desc', label: 'Stage ↓' },
  { value: 'stage-asc', label: 'Stage ↑' },
  { value: 'liq-ratio', label: 'Liq Ratio' },
  { value: 'health', label: 'Worst Health' },
  { value: 'alpha', label: 'A–Z' },
] as const;

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'watching', label: 'Watching' },
  { value: 'active-lp', label: 'Active LP' },
  { value: 'research', label: 'Research' },
  { value: 'other', label: 'Other' },
] as const;

// ── helpers ───────────────────────────────────────────────────────────────────

function classifyStage(mc: number): { stage: number; label: string } {
  if (mc < 50_000) return { stage: 0, label: 'Launch' };
  if (mc < 250_000) return { stage: 1, label: 'Discovery' };
  if (mc < 1_000_000) return { stage: 2, label: 'Emerging' };
  if (mc < 5_000_000) return { stage: 3, label: 'Growth' };
  if (mc < 20_000_000) return { stage: 4, label: 'Established' };
  return { stage: 5, label: 'Institutional' };
}

function calcHealth(t: TokenLive): number {
  let s = 0;
  const liq = t.liqRatio;
  s += liq >= 10 ? 25 : liq >= 5 ? 15 : liq >= 2 ? 8 : 0;
  const vl = t.tvl > 0 ? t.vol24 / t.tvl : 0;
  s += vl >= 1 ? 20 : vl >= 0.3 ? 12 : vl >= 0.1 ? 6 : 0;
  const abs = Math.abs(t.priceChg);
  s += abs <= 5 ? 20 : abs <= 15 ? 12 : abs <= 30 ? 6 : 0;
  s += t.stage >= 2 && t.stage <= 4 ? 20 : t.stage === 1 || t.stage === 5 ? 10 : 0;
  s += t.pools <= 3 ? 15 : t.pools <= 6 ? 8 : 0;
  return Math.min(100, s);
}

function getAlert(t: TokenLive, health: number): { msg: string; level: 'red' | 'amber' } | null {
  if (t.liqRatio < 2) return { msg: 'Liq ratio critically low', level: 'red' };
  if (health < 40) return { msg: 'Health score critical', level: 'red' };
  if (Math.abs(t.priceChg) >= 20)
    return { msg: `Price ${t.priceChg > 0 ? '+' : ''}${t.priceChg.toFixed(0)}% 24h`, level: 'amber' };
  if (t.pools > 8) return { msg: `${t.pools} pools — fragmented`, level: 'amber' };
  return null;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function blankLive(): TokenLive {
  return {
    name: '…', symbol: '…', price: 0, mc: 0, tvl: 0, vol24: 0,
    liqRatio: 0, priceChg: 0, estFees: 0, stage: 0, stageLabel: '—',
    pools: 0, loading: true, error: false,
  };
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  userEmail: string;
  initialRows: PortfolioRow[];
}

export default function PortfolioClient({ userId, userEmail, initialRows }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [entries, setEntries] = useState<PortfolioEntry[]>(() =>
    initialRows.map((r) => ({ ...r, live: blankLive() })),
  );
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [sort, setSort] = useState<string>('stage-desc');
  const [filter, setFilter] = useState<string>('all');
  const fetchedRef = useRef(new Set<string>());

  // Fetch live DexScreener data for a single token
  const fetchLive = useCallback(
    async (mintAddress: string) => {
      try {
        const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
        const d = await r.json();
        const pairs: Record<string, unknown>[] = d.pairs ?? [];

        if (!pairs.length) {
          setEntries((prev) =>
            prev.map((e) =>
              e.mint_address === mintAddress
                ? { ...e, live: { ...e.live, name: 'Not found', symbol: '?', loading: false, error: true } }
                : e,
            ),
          );
          return;
        }

        const first = pairs[0] as Record<string, unknown>;
        const base = (first.baseToken as Record<string, string>) ?? {};
        const mc = parseFloat((first.marketCap as string) ?? '0') || 0;
        let tvl = 0;
        let vol24 = 0;
        for (const p of pairs) {
          tvl += parseFloat(((p.liquidity as Record<string, string>)?.usd) ?? '0') || 0;
          vol24 += parseFloat(((p.volume as Record<string, string>)?.h24) ?? '0') || 0;
        }
        const { stage, label: stageLabel } = classifyStage(mc);
        const live: TokenLive = {
          name: base.name ?? 'Unknown',
          symbol: base.symbol ?? '?',
          price: parseFloat((first.priceUsd as string) ?? '0') || 0,
          mc, tvl, vol24,
          liqRatio: mc > 0 ? (tvl / mc) * 100 : 0,
          priceChg: parseFloat(((first.priceChange as Record<string, string>)?.h24) ?? '0') || 0,
          estFees: vol24 * 0.003,
          stage, stageLabel,
          pools: pairs.length,
          loading: false,
          error: false,
        };

        setEntries((prev) =>
          prev.map((e) => (e.mint_address === mintAddress ? { ...e, live } : e)),
        );
      } catch {
        setEntries((prev) =>
          prev.map((e) =>
            e.mint_address === mintAddress
              ? { ...e, live: { ...e.live, name: 'Fetch error', loading: false, error: true } }
              : e,
          ),
        );
      }
    },
    [],
  );

  // On mount, fetch live data for all initial tokens
  useEffect(() => {
    for (const row of initialRows) {
      if (!fetchedRef.current.has(row.mint_address)) {
        fetchedRef.current.add(row.mint_address);
        fetchLive(row.mint_address);
      }
    }
  }, [initialRows, fetchLive]);

  // ── DB operations ────────────────────────────────────────────────────────────

  async function addToken() {
    const addr = input.trim();
    if (!addr) return;
    if (entries.length >= 50) { alert('Maximum 50 tokens.'); return; }
    if (entries.find((e) => e.mint_address === addr)) { setInput(''); return; }

    setAdding(true);
    const { data, error } = await supabase
      .from('portfolio_tokens')
      .insert({ user_id: userId, mint_address: addr })
      .select('id, user_id, mint_address, tag, added_at')
      .single();

    if (error || !data) {
      setAdding(false);
      alert(error?.message ?? 'Failed to add token.');
      return;
    }

    const newEntry: PortfolioEntry = { ...(data as PortfolioRow), live: blankLive() };
    setEntries((prev) => [newEntry, ...prev]);
    setInput('');
    setAdding(false);
    fetchedRef.current.add(addr);
    fetchLive(addr);
  }

  async function removeToken(id: string, mintAddress: string) {
    await supabase.from('portfolio_tokens').delete().eq('id', id);
    fetchedRef.current.delete(mintAddress);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function cycleTag(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const ci = TAG_CYCLE.indexOf(entry.tag);
    const nextTag = TAG_CYCLE[(ci + 1) % TAG_CYCLE.length];
    await supabase.from('portfolio_tokens').update({ tag: nextTag }).eq('id', id);
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, tag: nextTag } : e)));
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  // ── derived list ─────────────────────────────────────────────────────────────

  const visible = entries
    .filter((e) => filter === 'all' || e.tag === filter)
    .sort((a, b) => {
      switch (sort) {
        case 'stage-desc': return b.live.stage - a.live.stage;
        case 'stage-asc': return a.live.stage - b.live.stage;
        case 'liq-ratio': return b.live.liqRatio - a.live.liqRatio;
        case 'health': return calcHealth(a.live) - calcHealth(b.live);
        case 'alpha': return a.live.name.localeCompare(b.live.name);
        default: return 0;
      }
    });

  // ── styles ───────────────────────────────────────────────────────────────────

  function chipStyle(active: boolean): React.CSSProperties {
    return {
      fontFamily: 'inherit', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '4px 10px', border: '1px solid', borderRadius: 4, cursor: 'pointer',
      background: active ? 'var(--surface2)' : 'transparent',
      borderColor: active ? 'rgba(255,255,255,0.2)' : 'var(--border)',
      color: active ? 'var(--text)' : 'var(--text-dim)',
    };
  }

  const cs: Record<string, React.CSSProperties> = {
    page: { padding: '20px 20px', maxWidth: 880, margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    sectionLabel: { fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' },
    userRow: { fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 10 },
    signOutBtn: { fontFamily: 'inherit', fontSize: 10, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' },
    addRow: { display: 'flex', gap: 8, marginBottom: 10 },
    addInput: { flex: 1, fontFamily: 'inherit', fontSize: 12, padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', outline: 'none' },
    addBtn: { fontFamily: 'inherit', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '7px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer' },
    controls: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' },
    divider: { width: 1, height: 14, background: 'var(--border)', margin: '0 4px' },
    empty: { color: 'var(--text-dim)', fontSize: 11, padding: '20px 0', textAlign: 'center' },
    card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 14px', marginBottom: 8 },
    cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
    tokenName: { fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1 },
    sym: { fontSize: 11, color: 'var(--text-dim)' },
    metrics: { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 6 },
    metric: { display: 'flex', flexDirection: 'column', gap: 2 },
    metricLabel: { fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' },
    metricValue: { fontSize: 13, fontWeight: 500, color: 'var(--text)' },
    addr: { fontSize: 9, color: '#333', wordBreak: 'break-all', marginBottom: 4 },
    cardFooter: { display: 'flex', alignItems: 'center', gap: 8 },
    removeBtn: { fontFamily: 'inherit', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-dim)', cursor: 'pointer', marginLeft: 'auto' },
  };

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div style={cs.page}>
      {/* header */}
      <div style={cs.header}>
        <span style={cs.sectionLabel}>Portfolio</span>
        <div style={cs.userRow}>
          <span>{userEmail}</span>
          <button style={cs.signOutBtn} onClick={signOut}>Sign out</button>
        </div>
      </div>

      {/* add token */}
      <div style={cs.addRow}>
        <input
          style={cs.addInput}
          placeholder="Add token mint address…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addToken()}
        />
        <button style={cs.addBtn} onClick={addToken} disabled={adding}>
          {adding ? '…' : '+ Add'}
        </button>
      </div>

      {/* sort + filter controls */}
      <div style={cs.controls}>
        {SORT_OPTIONS.map((o) => (
          <button key={o.value} style={chipStyle(sort === o.value)} onClick={() => setSort(o.value)}>
            {o.label}
          </button>
        ))}
        <div style={cs.divider} />
        {FILTER_OPTIONS.map((o) => (
          <button key={o.value} style={chipStyle(filter === o.value)} onClick={() => setFilter(o.value)}>
            {o.label}
          </button>
        ))}
      </div>

      {/* token list */}
      {visible.length === 0 && (
        <div style={cs.empty}>
          {entries.length === 0
            ? 'No tokens tracked yet. Add a mint address above.'
            : 'No tokens match the current filter.'}
        </div>
      )}

      {visible.map((entry) => {
        const { live } = entry;
        const health = calcHealth(live);
        const alert = live.loading || live.error ? null : getAlert(live, health);
        const liqColor = live.liqRatio >= 5 ? '#1D9E75' : live.liqRatio >= 2 ? '#BA7517' : '#c94a4a';
        const chgColor = live.priceChg >= 0 ? '#1D9E75' : '#c94a4a';

        return (
          <div key={entry.id} style={cs.card}>
            <div style={cs.cardHeader}>
              {/* stage badge */}
              <span style={{
                fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '2px 6px', borderRadius: 4,
                background: `${STAGE_COLORS[live.stage]}22`,
                color: STAGE_COLORS[live.stage],
                border: `1px solid ${STAGE_COLORS[live.stage]}44`,
                whiteSpace: 'nowrap',
              }}>
                S{live.stage} {live.stageLabel}
              </span>

              {/* name + sym */}
              <span style={cs.tokenName}>
                {live.loading ? '…' : live.name}
              </span>
              <span style={cs.sym}>{live.loading ? '' : live.symbol}</span>

              {/* tag badge (click to cycle) */}
              <button
                onClick={() => cycleTag(entry.id)}
                style={{
                  fontFamily: 'inherit', fontSize: 9, letterSpacing: '0.06em',
                  textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, cursor: 'pointer',
                  background: entry.tag ? `${TAG_META[entry.tag].color}22` : 'transparent',
                  border: `1px solid ${entry.tag ? TAG_META[entry.tag].color + '44' : 'var(--border)'}`,
                  color: entry.tag ? TAG_META[entry.tag].color : 'var(--text-dim)',
                }}
              >
                {entry.tag ? TAG_META[entry.tag].label : '+ Tag'}
              </button>
            </div>

            {/* address */}
            <div style={cs.addr}>{entry.mint_address}</div>

            {/* metrics */}
            {!live.loading && !live.error && (
              <div style={cs.metrics}>
                <div style={cs.metric}>
                  <span style={cs.metricLabel}>Price</span>
                  <span style={cs.metricValue}>${live.price < 0.01 ? live.price.toExponential(2) : live.price.toFixed(4)}</span>
                </div>
                <div style={cs.metric}>
                  <span style={cs.metricLabel}>MC</span>
                  <span style={cs.metricValue}>{fmt(live.mc)}</span>
                </div>
                <div style={cs.metric}>
                  <span style={cs.metricLabel}>TVL</span>
                  <span style={cs.metricValue}>{fmt(live.tvl)}</span>
                </div>
                <div style={cs.metric}>
                  <span style={cs.metricLabel}>Vol 24h</span>
                  <span style={cs.metricValue}>{fmt(live.vol24)}</span>
                </div>
                <div style={cs.metric}>
                  <span style={cs.metricLabel}>Liq Ratio</span>
                  <span style={{ ...cs.metricValue, color: liqColor }}>{live.liqRatio.toFixed(1)}%</span>
                </div>
                <div style={cs.metric}>
                  <span style={cs.metricLabel}>24h Δ</span>
                  <span style={{ ...cs.metricValue, color: chgColor }}>{fmtPct(live.priceChg)}</span>
                </div>
                <div style={cs.metric}>
                  <span style={cs.metricLabel}>Est. Fees/d</span>
                  <span style={cs.metricValue}>{fmt(live.estFees)}</span>
                </div>
                <div style={cs.metric}>
                  <span style={cs.metricLabel}>Health</span>
                  <span style={{ ...cs.metricValue, color: health >= 70 ? '#1D9E75' : health >= 45 ? '#BA7517' : '#c94a4a' }}>
                    {health}
                  </span>
                </div>
              </div>
            )}

            {live.loading && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Fetching live data…</div>}
            {live.error && <div style={{ fontSize: 11, color: '#c94a4a', marginBottom: 6 }}>{live.name}</div>}

            {/* footer: alert + health bar + remove */}
            <div style={cs.cardFooter}>
              {alert && (
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 4,
                  background: alert.level === 'red' ? '#c94a4a22' : '#BA751722',
                  color: alert.level === 'red' ? '#c94a4a' : '#BA7517',
                  border: `1px solid ${alert.level === 'red' ? '#c94a4a44' : '#BA751744'}`,
                }}>
                  {alert.msg}
                </span>
              )}

              {/* health bar */}
              {!live.loading && !live.error && (
                <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', maxWidth: 80 }}>
                  <div style={{
                    height: '100%', width: `${health}%`,
                    background: health >= 70 ? '#1D9E75' : health >= 45 ? '#BA7517' : '#c94a4a',
                    borderRadius: 2,
                  }} />
                </div>
              )}

              <button style={cs.removeBtn} onClick={() => removeToken(entry.id, entry.mint_address)}>
                Remove
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
