-- Resend OTP verification codes
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor).

create table if not exists public.waitlist_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

-- Index for rate-limit check: one recent code per email
create index if not exists waitlist_codes_email_idx
  on public.waitlist_codes (email, created_at desc);

-- Index for code lookup: email + code + not used + not expired
create index if not exists waitlist_codes_lookup_idx
  on public.waitlist_codes (email, code, used, expires_at)
  where used = false;

-- Allow the API routes (which use the anon key) to manage codes.
-- The codes themselves are not sensitive beyond the 10-minute expiry.
alter table public.waitlist_codes enable row level security;

drop policy if exists "anon can manage waitlist_codes" on public.waitlist_codes;
create policy "anon can manage waitlist_codes"
  on public.waitlist_codes
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);

grant all on public.waitlist_codes to anon, authenticated, service_role;

-- Auto-cleanup old codes (keep for 24 hours) — optional, ignore if pg_cron not available
do $do$
begin
  perform cron.schedule(
    'cleanup-waitlist-codes',
    '0 * * * *',
    $inner$ delete from public.waitlist_codes where created_at < now() - interval '24 hours' $inner$
  );
exception when others then
  -- pg_cron not enabled or not permitted — cleanup can be done manually
  null;
end $do$;

-- ============================================================
-- Updated confirm_waitlist() — adds p_email parameter
-- so it works without Supabase Auth JWT.
-- ============================================================

create or replace function public.confirm_waitlist(
  p_wallet text default null,
  p_ref text default null,
  p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := coalesce(
    nullif(lower(trim(both from coalesce(p_email, ''))), ''),
    lower(nullif(trim(both from coalesce(auth.jwt() ->> 'email', '')), ''))
  );
  v_wallet text := nullif(lower(trim(both from coalesce(p_wallet, ''))), '');
  v_ref text := nullif(lower(trim(both from coalesce(p_ref, ''))), '');
  v_referrer uuid;
  v_row public.waitlist%rowtype;
  v_status text := 'joined';
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_wallet is not null and v_wallet !~ '^0x[0-9a-f]{40}$' then
    raise exception 'invalid wallet' using errcode = '22023';
  end if;

  if v_wallet is not null then
    perform 1
    from public.waitlist
    where wallet_address = v_wallet
      and lower(email) <> v_email;
    if found then
      raise exception 'wallet already registered' using errcode = '23505';
    end if;
  end if;

  select * into v_row
  from public.waitlist
  where lower(email) = v_email
  limit 1;

  if found then
    if v_row.verified_at is null then
      update public.waitlist
      set verified_at = now(),
          wallet_address = coalesce(waitlist.wallet_address, v_wallet)
      where id = v_row.id
      returning * into v_row;
      v_status := 'joined';
    else
      v_status := 'already';
      if v_wallet is not null and v_row.wallet_address is null then
        update public.waitlist
        set wallet_address = v_wallet
        where id = v_row.id
        returning * into v_row;
      end if;
    end if;
  else
    if v_ref is not null then
      select id into v_referrer
      from public.waitlist
      where referral_code = v_ref
        and verified_at is not null
        and lower(email) <> v_email;
    end if;

    begin
      insert into public.waitlist (email, wallet_address, referred_by, verified_at)
      values (v_email, v_wallet, v_referrer, now())
      returning * into v_row;
    exception
      when unique_violation then
        if v_wallet is not null and exists (
          select 1 from public.waitlist
          where wallet_address = v_wallet and lower(email) <> v_email
        ) then
          raise exception 'wallet already registered' using errcode = '23505';
        end if;
        select * into v_row
        from public.waitlist
        where lower(email) = v_email
        limit 1;
        if not found then
          raise;
        end if;
        if v_row.verified_at is null then
          update public.waitlist
          set verified_at = now()
          where id = v_row.id
          returning * into v_row;
          v_status := 'joined';
        else
          v_status := 'already';
        end if;
    end;
  end if;

  return public.waitlist_share_payload(v_row, v_status);
end;
$$;

-- Re-grant with new signature
revoke all on function public.confirm_waitlist(text, text, text) from public;
grant execute on function public.confirm_waitlist(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
