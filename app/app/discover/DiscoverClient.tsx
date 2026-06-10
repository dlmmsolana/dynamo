'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { renderDiscCard, renderDiscGrid } from '../../lib/discover/render';
import type { DiscToken } from '../../lib/discover/render';

export default function DiscoverClient() {
  const router = useRouter();

  const [tokenData, setTokenData]           = useState<DiscToken[]>([]);
  const [searchResults, setSearchResults]   = useState<DiscToken[]>([]);
  const [isSearchMode, setIsSearchMode]     = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [mode, setMode]                     = useState<'volume' | 'mcchange'>('volume');
  const [time, setTime]                     = useState<'1' | '4' | '12' | '24'>('24');
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const [addedAddresses, setAddedAddresses] = useState<Set<string>>(new Set());

  const addedRef    = useRef<Set<string>>(new Set());
  const searchRef   = useRef<HTMLInputElement>(null);
  const hasLoadedRef = useRef(false);

  // ── Trending fetch ────────────────────────────────────────────────────────
  const fetchTrending = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/dexscreener/trending');
      const d = await r.json();
      if (!d.tokens?.length) {
        setError('No Solana trending data available.');
      } else {
        setTokenData(d.tokens);
      }
    } catch {
      setError('Failed to load trending data.');
    } finally {
      setLoading(false);
    }
  };

  // Load once on mount
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    fetchTrending();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Init added-addresses from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored: { address: string }[] = JSON.parse(localStorage.getItem('slt_portfolio') || '[]');
      const init = new Set<string>(stored.map((t) => t.address));
      addedRef.current = init;
      setAddedAddresses(new Set(init));
    } catch { /* ignore */ }
  }, []);

  // ── window._dynamo helpers for onclick strings inside dangerouslySetInnerHTML
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = ((window as any)._dynamo = (window as any)._dynamo || {});

    d.openAudit  = (addr: string) => router.push('/auditor?addr=' + encodeURIComponent(addr));
    d.openLiveLP = (addr: string) => router.push('/livelp?addr=' + encodeURIComponent(addr));

    d.addToPortfolio = (addr: string, btn: HTMLButtonElement) => {
      try {
        const list: { address: string }[] = JSON.parse(localStorage.getItem('slt_portfolio') || '[]');
        if (list.find((t) => t.address === addr)) {
          if (btn) { btn.textContent = '✓ Added'; (btn as HTMLButtonElement).disabled = true; }
          return;
        }
        if (list.length >= 50) { alert('Maximum 50 tokens.'); return; }
        list.push({
          address: addr, name: '...', symbol: '...', mc: 0, tvl: 0,
          vol24: 0, liqRatio: 0, priceChg: 0, stage: 0, stageLabel: '—',
          loading: true,
        } as unknown as { address: string });
        localStorage.setItem('slt_portfolio', JSON.stringify(list));
        const next = new Set([...addedRef.current, addr]);
        addedRef.current = next;
        setAddedAddresses(new Set(next));
      } catch { /* ignore */ }
    };

    d.refreshTrending = () => {
      setIsSearchMode(false);
      setSearchQuery('');
      setSearchResults([]);
      setTokenData([]);
      setError('');
      if (searchRef.current) searchRef.current.value = '';
      fetchTrending();
    };

    d.restoreDiscover = () => {
      setIsSearchMode(false);
      setSearchQuery('');
      if (searchRef.current) searchRef.current.value = '';
    };
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const raw = (searchRef.current?.value || '').trim();
    if (!raw) return;
    const q = raw.startsWith('$') ? raw.slice(1) : raw;
    setLoading(true);
    setError('');
    setSearchQuery(raw);
    try {
      const r = await fetch('/api/dexscreener/search?q=' + encodeURIComponent(q));
      const d = await r.json();
      setSearchResults(d.tokens || []);
      setIsSearchMode(true);
    } catch {
      setError('Search failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Grid HTML (recomputed whenever deps change) ───────────────────────────
  const gridContent = useMemo(() => {
    if (isSearchMode) {
      const count = searchResults.length;
      const backBtn = `<button class="disc-btn" onclick="window._dynamo && window._dynamo.restoreDiscover()">← Trending</button>`;
      if (!count) {
        return `<div style="margin-bottom:12px;">${backBtn}</div><div class="ph2">No Solana results for <strong style="color:#e8e8e6;">${searchQuery}</strong>.</div>`;
      }
      const cards = searchResults.map((t) => renderDiscCard(t, addedAddresses.has(t.address))).join('');
      return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">${backBtn}<span style="font-size:10px;color:#555552;">${count} result${count !== 1 ? 's' : ''} for <strong style="color:#e8e8e6;">${searchQuery}</strong> · sorted by 24h volume</span></div><div class="disc-grid">${cards}</div>`;
    }

    if (!tokenData.length) return '';
    const gridHTML = renderDiscGrid(tokenData, mode, time, addedAddresses);
    const refreshBtn = `<button class="disc-btn" style="padding:2px 8px;margin-top:8px;" onclick="window._dynamo && window._dynamo.refreshTrending()">↺ Refresh</button>`;
    return gridHTML + refreshBtn;
  }, [tokenData, searchResults, mode, time, isSearchMode, searchQuery, addedAddresses]);

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
        Discover
      </div>

      {/* Search bar */}
      <div className="arow" style={{ marginBottom: 14 }}>
        <input
          ref={searchRef}
          id="disc-search"
          placeholder="Search by ticker ($SOL), name, or contract address..."
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          style={{ flex: 1 }}
        />
        <button className="rbtn" style={{ marginBottom: 0 }} onClick={handleSearch}>
          Search
        </button>
      </div>

      {/* Mode + time controls */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <button className={`disc-btn${mode === 'volume' ? ' primary' : ''}`} onClick={() => setMode('volume')}>
          Volume
        </button>
        <button className={`disc-btn${mode === 'mcchange' ? ' primary' : ''}`} onClick={() => setMode('mcchange')}>
          MC Change
        </button>
        <span style={{ fontSize: 10, color: '#333330', margin: '0 4px' }}>|</span>
        {(['1', '4', '12', '24'] as const).map((t) => (
          <button
            key={t}
            className={`disc-btn${time === t ? ' primary' : ''}`}
            onClick={() => setTime(t)}
          >
            {t === '1' ? '1h' : t === '4' ? '~4h' : t === '12' ? '~12h' : '24h'}
          </button>
        ))}
      </div>

      {loading && <div className="blink">Loading...</div>}

      {error && !loading && (
        <div>
          <div className="err" style={{ marginBottom: 8 }}>{error}</div>
          <button className="disc-btn" onClick={() => { setError(''); fetchTrending(); }}>
            Retry
          </button>
        </div>
      )}

      {gridContent && !loading && (
        <div dangerouslySetInnerHTML={{ __html: gridContent }} />
      )}
    </div>
  );
}
