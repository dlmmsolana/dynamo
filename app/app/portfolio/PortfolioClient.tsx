'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { PortfolioEntry, PortfolioRow, Tag, TokenLive } from '@/lib/types';
import { validateAddress, CHAINS } from '@/lib/chains';

// ── constants ─────────────────────────────────────────────────────────────────

const LS_KEY = 'slt_portfolio';
const LS_META_KEY = 'slt_portfolio_meta';

const TAG_CYCLE: Tag[] = [null, 'watching', 'active-lp', 'research', 'other'];

const TAG_META: Record<NonNullable<Tag>, { label: string; color: string }> = {
  watching:   { label: 'Watching',  color: '#BA7517' },
  'active-lp':{ label: 'Active LP', color: '#1D9E75' },
  research:   { label: 'Research',  color: '#378ADD' },
  other:      { label: 'Other',     color: '#7F77DD' },
};

const STAGE_COLORS = ['#888780', '#1D9E75', '#378ADD', '#BA7517', '#D85A30', '#993556'];

const SORT_OPTIONS = [
  { value: 'mc-desc',   label: 'MC ↓'   },
  { value: 'tvl-desc',  label: 'TVL ↓'  },
  { value: 'vol-desc',  label: 'Vol ↓'  },
  { value: 'chg-abs',   label: '24h Δ'  },
  { value: 'date-desc', label: 'Newest' },
] as const;

const FILTER_OPTIONS = [
  { value: 'all',       label: 'All'       },
  { value: 'watching',  label: 'Watching'  },
  { value: 'active-lp', label: 'Active LP' },
  { value: 'research',  label: 'Research'  },
  { value: 'other',     label: 'Other'     },
] as const;

// ── localStorage helpers ──────────────────────────────────────────────────────

interface LSMeta { tag: Tag; added_at: string }

function lsRead(): { addresses: string[]; meta: Record<string, LSMeta> } {
  if (typeof window === 'undefined') return { addresses: [], meta: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]') as { address?: string }[];
    const addresses = raw.map((r) => r.address).filter(Boolean) as string[];
    const meta = JSON.parse(localStorage.getItem(LS_META_KEY) || '{}') as Record<string, LSMeta>;
    return { addresses, meta };
  } catch {
    return { addresses: [], meta: {} };
  }
}

function lsAddAddress(addr: string): LSMeta {
  try {
    const raw: { address: string }[] = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    if (!raw.find((r) => r.address === addr)) {
      raw.push({ address: addr });
      localStorage.setItem(LS_KEY, JSON.stringify(raw));
    }
    const meta: Record<string, LSMeta> = JSON.parse(localStorage.getItem(LS_META_KEY) || '{}');
    if (!meta[addr]) meta[addr] = { tag: null, added_at: new Date().toISOString() };
    localStorage.setItem(LS_META_KEY, JSON.stringify(meta));
    return meta[addr];
  } catch {
    return { tag: null, added_at: new Date().toISOString() };
  }
}

function lsRemoveAddress(addr: string): void {
  try {
    const raw: { address: string }[] = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    localStorage.setItem(LS_KEY, JSON.stringify(raw.filter((r) => r.address !== addr)));
    const meta: Record<string, LSMeta> = JSON.parse(localStorage.getItem(LS_META_KEY) || '{}');
    delete meta[addr];
    localStorage.setItem(LS_META_KEY, JSON.stringify(meta));
  } catch { /* ignore */ }
}

function lsSetTag(addr: string, tag: Tag): void {
  try {
    const meta: Record<string, LSMeta> = JSON.parse(localStorage.getItem(LS_META_KEY) || '{}');
    meta[addr] = { ...(meta[addr] ?? { added_at: new Date().toISOString() }), tag };
    localStorage.setItem(LS_META_KEY, JSON.stringify(meta));
  } catch { /* ignore */ }
}

function lsBuildRows(addresses: string[], meta: Record<string, LSMeta>): PortfolioRow[] {
  return addresses.map((addr) => ({
    id: addr,
    user_id: '',
    mint_address: addr,
    tag: meta[addr]?.tag ?? null,
    added_at: meta[addr]?.added_at ?? new Date().toISOString(),
    chain: 'solana' as const,
  }));
}

// ── domain helpers ────────────────────────────────────────────────────────────

function classifyStage(mc: number): { stage: number; label: string } {
  if (mc < 50_000)    return { stage: 0, label: 'Launch' };
  if (mc < 250_000)   return { stage: 1, label: 'Discovery' };
  if (mc < 1_000_000) return { stage: 2, label: 'Emerging' };
  if (mc < 5_000_000) return { stage: 3, label: 'Growth' };
  if (mc < 20_000_000)return { stage: 4, label: 'Established' };
  return { stage: 5, label: 'Institutional' };
}

function calcHealth(t: TokenLive): number {
  let s = 0;
  s += t.liqRatio >= 10 ? 25 : t.liqRatio >= 5 ? 15 : t.liqRatio >= 2 ? 8 : 0;
  const vl = t.tvl > 0 ? t.vol24 / t.tvl : 0;
  s += vl >= 1 ? 20 : vl >= 0.3 ? 12 : vl >= 0.1 ? 6 : 0;
  const abs = Math.abs(t.priceChg);
  s += abs <= 5 ? 20 : abs <= 15 ? 12 : abs <= 30 ? 6 : 0;
  s += t.stage >= 2 && t.stage <= 4 ? 20 : (t.stage === 1 || t.stage === 5) ? 10 : 0;
  s += t.pools <= 3 ? 15 : t.pools <= 6 ? 8 : 0;
  return Math.min(100, s);
}

function getAlert(t: TokenLive, health: number): { msg: string; level: 'red' | 'amber' } | null {
  if (t.liqRatio < 2)          return { msg: 'Liq ratio critically low', level: 'red' };
  if (health < 40)             return { msg: 'Health score critical', level: 'red' };
  if (Math.abs(t.priceChg) >= 20)
    return { msg: `Price ${t.priceChg > 0 ? '+' : ''}${t.priceChg.toFixed(0)}% 24h`, level: 'amber' };
  if (t.pools > 8)             return { msg: `${t.pools} pools — fragmented`, level: 'amber' };
  return null;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
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
  userId: string | null;
  userEmail: string;
  initialRows: PortfolioRow[];
}

export default function PortfolioClient({ userId, userEmail, initialRows }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [entries, setEntries] = useState<PortfolioEntry[]>(() =>
    initialRows.map((r) => ({ ...r, live: blankLive() })),
  );
  const [input, setInput]   = useState('');
  const [adding, setAdding] = useState(false);
  const [sort, setSort]     = useState<string>('date-desc');
  const [filter, setFilter] = useState<string>('all');
  // addresses in localStorage not yet in Supabase (when logged in)
  const [lsImport, setLsImport] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const fetchedRef = useRef(new Set<string>());

  // ── fetch live data (via proxy) ───────────────────────────────────────────

  const fetchLive = useCallback(async (mintAddress: string) => {
    try {
      const r = await fetch(`/api/dexscreener?address=${mintAddress}`);
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
      const base  = (first.baseToken as Record<string, string>) ?? {};
      const mc = parseFloat((first.marketCap as string) ?? '0') || 0;
      let tvl = 0, vol24 = 0;
      for (const p of pairs) {
        tvl   += parseFloat(((p.liquidity as Record<string, string>)?.usd) ?? '0') || 0;
        vol24 += parseFloat(((p.volume   as Record<string, string>)?.h24) ?? '0') || 0;
      }
      const { stage, label: stageLabel } = classifyStage(mc);
      const live: TokenLive = {
        name:  base.name   ?? 'Unknown',
        symbol:base.symbol ?? '?',
        price: parseFloat((first.priceUsd as string) ?? '0') || 0,
        mc, tvl, vol24,
        liqRatio: mc > 0 ? (tvl / mc) * 100 : 0,
        priceChg: parseFloat(((first.priceChange as Record<string, string>)?.h24) ?? '0') || 0,
        estFees:  vol24 * 0.003,
        stage, stageLabel,
        pools: pairs.length,
        loading: false, error: false,
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
  }, []);

  // ── mount effects ─────────────────────────────────────────────────────────

  // Supabase mode: fetch live data; surface any unsynced localStorage tokens
  useEffect(() => {
    if (!userId) return;
    for (const row of initialRows) {
      if (!fetchedRef.current.has(row.mint_address)) {
        fetchedRef.current.add(row.mint_address);
        fetchLive(row.mint_address);
      }
    }
    if (typeof window === 'undefined') return;
    const { addresses } = lsRead();
    const inSupabase = new Set(initialRows.map((r) => r.mint_address));
    const pending = addresses.filter((a) => !inSupabase.has(a));
    if (pending.length) setLsImport(pending);
  }, [userId, initialRows, fetchLive]);

  // localStorage mode: load from LS and fetch live data
  useEffect(() => {
    if (userId || typeof window === 'undefined') return;
    const { addresses, meta } = lsRead();
    const rows = lsBuildRows(addresses, meta);
    setEntries(rows.map((r) => ({ ...r, live: blankLive() })));
    for (const r of rows) {
      if (!fetchedRef.current.has(r.mint_address)) {
        fetchedRef.current.add(r.mint_address);
        fetchLive(r.mint_address);
      }
    }
  }, [userId, fetchLive]);

  // ── Supabase operations ───────────────────────────────────────────────────

  async function sbAdd(addr: string): Promise<PortfolioRow | null> {
    const { data, error } = await supabase
      .from('portfolio_tokens')
      .insert({ user_id: userId, mint_address: addr })
      .select('id, user_id, mint_address, tag, added_at')
      .single();
    if (error || !data) { alert(error?.message ?? 'Failed to add token.'); return null; }
    return { ...data, chain: 'solana' as const } as PortfolioRow;
  }

  async function importFromLocalStorage() {
    if (!lsImport.length) return;
    setImporting(true);
    const imported: PortfolioEntry[] = [];
    for (const addr of lsImport) {
      const row = await sbAdd(addr);
      if (row) {
        imported.push({ ...row, live: blankLive() });
        fetchedRef.current.add(addr);
        fetchLive(addr);
      }
    }
    setEntries((prev) => [...imported, ...prev]);
    setLsImport([]);
    setImporting(false);
  }

  // ── add / remove / tag ────────────────────────────────────────────────────

  async function addToken() {
    const addr = input.trim();
    if (!addr) return;
    if (!validateAddress(addr)) { alert(`Invalid address — expected a ${CHAINS.solana.addressHint}.`); return; }
    if (entries.length >= 50) { alert('Maximum 50 tokens.'); return; }
    if (entries.find((e) => e.mint_address === addr)) { setInput(''); return; }

    setAdding(true);

    if (userId) {
      const row = await sbAdd(addr);
      setAdding(false);
      if (!row) return;
      setEntries((prev) => [{ ...row, live: blankLive() }, ...prev]);
    } else {
      const lsMeta = lsAddAddress(addr);
      const row: PortfolioRow = {
        id: addr, user_id: '', mint_address: addr,
        tag: lsMeta.tag, added_at: lsMeta.added_at, chain: 'solana',
      };
      setEntries((prev) => [{ ...row, live: blankLive() }, ...prev]);
      setAdding(false);
    }

    setInput('');
    fetchedRef.current.add(addr);
    fetchLive(addr);
  }

  async function removeToken(id: string, mintAddress: string) {
    if (userId) {
      await supabase.from('portfolio_tokens').delete().eq('id', id);
    } else {
      lsRemoveAddress(mintAddress);
    }
    fetchedRef.current.delete(mintAddress);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function cycleTag(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const nextTag = TAG_CYCLE[(TAG_CYCLE.indexOf(entry.tag) + 1) % TAG_CYCLE.length];
    if (userId) {
      await supabase.from('portfolio_tokens').update({ tag: nextTag }).eq('id', id);
    } else {
      lsSetTag(entry.mint_address, nextTag);
    }
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, tag: nextTag } : e)));
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  // ── derived list ──────────────────────────────────────────────────────────

  const visible = entries
    .filter((e) => filter === 'all' || e.tag === filter)
    .sort((a, b) => {
      if (a.live.loading && !b.live.loading) return 1;
      if (!a.live.loading && b.live.loading) return -1;
      switch (sort) {
        case 'mc-desc':   return b.live.mc     - a.live.mc;
        case 'tvl-desc':  return b.live.tvl    - a.live.tvl;
        case 'vol-desc':  return b.live.vol24  - a.live.vol24;
        case 'chg-abs':   return Math.abs(b.live.priceChg) - Math.abs(a.live.priceChg);
        case 'date-desc': return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
        default: return 0;
      }
    });

  // ── styles ────────────────────────────────────────────────────────────────

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
    page:         { padding: '20px', maxWidth: 880, margin: '0 auto' },
    header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    sectionLabel: { fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' },
    userRow:      { fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 10 },
    signOutBtn:   { fontFamily: 'inherit', fontSize: 10, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' },
    signInLink:   { fontFamily: 'inherit', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#378ADD', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
    banner:       { fontSize: 11, color: 'var(--text-dim)', padding: '8px 12px', marginBottom: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    importBtn:    { fontFamily: 'inherit', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' },
    addRow:       { display: 'flex', gap: 8, marginBottom: 10 },
    addInput:     { flex: 1, fontFamily: 'inherit', fontSize: 12, padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', outline: 'none' },
    addBtn:       { fontFamily: 'inherit', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '7px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer' },
    controls:     { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' },
    divider:      { width: 1, height: 14, background: 'var(--border)', margin: '0 4px' },
    empty:        { color: 'var(--text-dim)', fontSize: 11, padding: '20px 0', textAlign: 'center' },
    card:         { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 14px', marginBottom: 8 },
    cardHeader:   { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
    tokenName:    { fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1, cursor: 'pointer' },
    sym:          { fontSize: 11, color: 'var(--text-dim)' },
    metrics:      { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 6 },
    metric:       { display: 'flex', flexDirection: 'column', gap: 2 },
    metricLabel:  { fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' },
    metricValue:  { fontSize: 13, fontWeight: 500, color: 'var(--text)' },
    addr:         { fontSize: 9, color: 'var(--text-dim)', wordBreak: 'break-all', marginBottom: 4, opacity: 0.4 },
    cardFooter:   { display: 'flex', alignItems: 'center', gap: 8 },
    removeBtn:    { fontFamily: 'inherit', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-dim)', cursor: 'pointer', marginLeft: 'auto' },
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={cs.page}>

      {/* header */}
      <div style={cs.header}>
        <span style={cs.sectionLabel}>Portfolio</span>
        {userId ? (
          <div style={cs.userRow}>
            <span>{userEmail}</span>
            <button style={cs.signOutBtn} onClick={signOut}>Sign out</button>
          </div>
        ) : (
          <button style={cs.signInLink} onClick={() => router.push('/login?next=/portfolio')}>
            Sign in to sync →
          </button>
        )}
      </div>

      {/* localStorage banner (not logged in) */}
      {!userId && (
        <div style={cs.banner}>
          <span>Tokens saved locally. Sign in to sync across devices.</span>
          <button style={cs.signInLink} onClick={() => router.push('/login?next=/portfolio')}>
            Sign in
          </button>
        </div>
      )}

      {/* import banner (logged in, localStorage has unsynced tokens) */}
      {userId && lsImport.length > 0 && (
        <div style={cs.banner}>
          <span>{lsImport.length} token{lsImport.length > 1 ? 's' : ''} in browser storage not synced to your account.</span>
          <button style={cs.importBtn} onClick={importFromLocalStorage} disabled={importing}>
            {importing ? 'Importing…' : `Import ${lsImport.length}`}
          </button>
        </div>
      )}

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

      {/* sort + filter */}
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

      {/* empty state */}
      {visible.length === 0 && (
        <div style={cs.empty}>
          {entries.length === 0
            ? 'No tokens tracked yet. Add a mint address above or use + Portfolio from Discover.'
            : 'No tokens match the current filter.'}
        </div>
      )}

      {/* token cards */}
      {visible.map((entry) => {
        const { live } = entry;
        const health   = calcHealth(live);
        const alert    = live.loading || live.error ? null : getAlert(live, health);
        const liqColor = live.liqRatio >= 5 ? '#1D9E75' : live.liqRatio >= 2 ? '#BA7517' : '#c94a4a';
        const chgColor = live.priceChg >= 0 ? '#1D9E75' : '#c94a4a';

        return (
          <div key={entry.id} style={cs.card}>
            <div style={cs.cardHeader}>
              {/* stage badge */}
              <span style={{
                fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                background: `${STAGE_COLORS[live.stage]}22`,
                color: STAGE_COLORS[live.stage],
                border: `1px solid ${STAGE_COLORS[live.stage]}44`,
              }}>
                S{live.stage} {live.stageLabel}
              </span>

              {/* name — click to open auditor */}
              <span
                style={cs.tokenName}
                onClick={() => router.push(`/auditor?addr=${encodeURIComponent(entry.mint_address)}`)}
                title="Open in Auditor"
              >
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
                  <span style={cs.metricValue}>
                    ${live.price < 0.01 ? live.price.toExponential(2) : live.price.toFixed(4)}
                  </span>
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

            {live.loading && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
                Fetching live data…
              </div>
            )}
            {live.error && (
              <div style={{ fontSize: 11, color: '#c94a4a', marginBottom: 6 }}>{live.name}</div>
            )}

            {/* footer: alert + health bar + remove */}
            <div style={cs.cardFooter}>
              {alert && (
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 4,
                  background: alert.level === 'red' ? '#c94a4a22' : '#BA751722',
                  color:      alert.level === 'red' ? '#c94a4a'   : '#BA7517',
                  border: `1px solid ${alert.level === 'red' ? '#c94a4a44' : '#BA751744'}`,
                }}>
                  {alert.msg}
                </span>
              )}

              {!live.loading && !live.error && (
                <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', maxWidth: 80 }}>
                  <div style={{
                    height: '100%', width: `${health}%`, borderRadius: 2,
                    background: health >= 70 ? '#1D9E75' : health >= 45 ? '#BA7517' : '#c94a4a',
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
