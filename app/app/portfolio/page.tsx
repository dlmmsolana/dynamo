import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { PortfolioRow } from '@/lib/types';
import PortfolioClient from './PortfolioClient';

export default async function PortfolioPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/portfolio');

  const { data: rows } = await supabase
    .from('portfolio_tokens')
    .select('id, user_id, mint_address, tag, added_at')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false });

  return (
    <PortfolioClient
      userId={user.id}
      userEmail={user.email ?? ''}
      initialRows={(rows ?? []) as PortfolioRow[]}
    />
  );
}
