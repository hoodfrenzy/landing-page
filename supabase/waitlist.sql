-- hoodfrenzy waitlist
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
--
-- Security model:
--   * anon may INSERT, and nothing else.
--   * NOBODY may SELECT through the API -- there is deliberately no select
--     policy, so the email/wallet list cannot be scraped with the anon key.
--   * The public signup count comes from waitlist_count(), a security-definer
--     function that returns a single number and never exposes rows.

create table if not exists public.waitlist (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  wallet_address text,
  created_at     timestamptz not null default now(),

  constraint waitlist_email_format
    check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

  -- EVM address: 0x + 40 hex chars. Null is allowed (wallet is optional).
  constraint waitlist_wallet_format
    check (wallet_address is null or wallet_address ~* '^0x[0-9a-f]{40}$')
);

-- Case-insensitive uniqueness: Foo@x.com and foo@x.com are the same person.
create unique index if not exists waitlist_email_unique
  on public.waitlist (lower(email));

create unique index if not exists waitlist_wallet_unique
  on public.waitlist (lower(wallet_address))
  where wallet_address is not null;

alter table public.waitlist enable row level security;

-- Explicit grant, because "Automatically expose new tables" is off.
-- INSERT only: no select, no update, no delete.
grant insert on public.waitlist to anon, authenticated;

drop policy if exists "anyone can join the waitlist" on public.waitlist;
create policy "anyone can join the waitlist"
  on public.waitlist
  for insert
  to anon, authenticated
  with check (true);

-- Public counter. Security definer so it can count rows the caller cannot read.
create or replace function public.waitlist_count()
returns bigint
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select count(*) from public.waitlist;
$$;

revoke all on function public.waitlist_count() from public;
grant execute on function public.waitlist_count() to anon, authenticated;
