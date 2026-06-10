-- ============================================================
-- Dynamo — Liquidity Terminal
-- Run this in the Supabase SQL Editor for your project.
-- ============================================================


-- ── users profile table ───────────────────────────────────────
-- Mirrors auth.users so we can store display metadata later.
-- Auto-populated via trigger on signup.

create table if not exists public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz default now()
);

alter table public.users enable row level security;

create policy "users: select own row"
  on public.users for select
  using (auth.uid() = id);

-- Trigger: insert a users row whenever a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── portfolio_tokens ──────────────────────────────────────────
-- One row per (user, token). tag is optional.

create table if not exists public.portfolio_tokens (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  mint_address text        not null,
  tag          text        check (tag in ('watching', 'active-lp', 'research', 'other')),
  added_at     timestamptz default now(),

  unique (user_id, mint_address)
);

alter table public.portfolio_tokens enable row level security;

create policy "portfolio: full access to own rows"
  on public.portfolio_tokens for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists portfolio_tokens_user_added
  on public.portfolio_tokens (user_id, added_at desc);


-- ── Supabase Auth configuration reminder ─────────────────────
-- In the Supabase dashboard → Authentication → URL Configuration:
--   Site URL:            http://localhost:3000          (dev)
--                        https://your-app.vercel.app    (prod)
--   Redirect URLs:       http://localhost:3000/auth/callback
--                        https://your-app.vercel.app/auth/callback
-- ─────────────────────────────────────────────────────────────
