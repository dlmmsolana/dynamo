import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LoginForm from './LoginForm';

interface Props {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect('/portfolio');

  const { next, error } = await searchParams;
  return <LoginForm next={next} serverError={error} />;
}
