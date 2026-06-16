import type { PortfolioRow } from '@/lib/types';
import PortfolioClient from './PortfolioClient';
import { createClient } from '@/lib/supabase/server';

export default async function PortfolioPage() {
  let userId: string | null = null;
  let userEmail = '';
  let rows: PortfolioRow[] = [];

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      userId = user.id;
      userEmail = user.email ?? '';
      const { data } = await supabase
        .from('portfolio_tokens')
        .select('id, user_id, mint_address, tag, added_at')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false });
      // portfolio_tokens has no chain column yet — default to solana on read.
      rows = (data ?? []).map((r) => ({ ...r, chain: 'solana' as const })) as PortfolioRow[];
    }
  } catch {
    // Supabase not configured — fall through to localStorage mode
  }

  return (
    <PortfolioClient userId={userId} userEmail={userEmail} initialRows={rows} />
  );
}
