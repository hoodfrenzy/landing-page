-- hoodfrenzy referrals + leaderboard + email verification
-- RE-RUN this in the Supabase SQL editor (Dashboard → SQL Editor).
-- Safe to re-run: every statement is idempotent.
--
-- Scoring (verified signups only)
--   * Direct referral (someone joined with your code):  10 points
--   * Second-degree (someone your referral referred):     2 points
--   * Deeper than 2 hops:                                 0
--
-- Verification
--   * A mailbox must receive a one-time code (Supabase Auth OTP) before a
--     row is counted. confirm_waitlist() reads auth.jwt() -> email.
--   * Unverified / fake addresses never earn points or occupy the board.

alter table public.waitlist
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.waitlist(id),
  add column if not exists verified_at timestamptz;

-- Codes first, then verify. The previous order skipped anyone who had not
-- received a code yet, so email lookup returned "no verified signup".
update public.waitlist
set referral_code = substr(replace(id::text, '-', ''), 1, 8)
where referral_code is null;

-- Everyone already on the list is grandfathered. New joins still go through OTP.
update public.waitlist
set verified_at = coalesce(created_at, now())
where verified_at is null;

create unique index if not exists waitlist_referral_code_unique
  on public.waitlist (referral_code);

create index if not exists waitlist_referred_by_idx
  on public.waitlist (referred_by)
  where referred_by is not null;

-- Anon must not INSERT: that was how a made-up email could squat the unique
-- index and farm points. Signups go through confirm_waitlist() after OTP.
revoke insert on public.waitlist from anon, authenticated;
drop policy if exists "anyone can join the waitlist" on public.waitlist;

-- ---------------------------------------------------------------
-- Assign a short unique code on insert if the caller didn't pass one.
-- ---------------------------------------------------------------
create or replace function public.waitlist_assign_code()
returns trigger
language plpgsql
as $$
declare
  c text;
  i int := 0;
begin
  if new.referral_code is not null and length(new.referral_code) > 0 then
    new.referral_code := lower(new.referral_code);
    return new;
  end if;
  loop
    c := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    exit when not exists (select 1 from public.waitlist where referral_code = c);
    i := i + 1;
    if i > 12 then
      raise exception 'could not allocate referral code';
    end if;
  end loop;
  new.referral_code := c;
  return new;
end;
$$;

drop trigger if exists waitlist_assign_code on public.waitlist;
create trigger waitlist_assign_code
  before insert on public.waitlist
  for each row
  execute procedure public.waitlist_assign_code();

-- ---------------------------------------------------------------
-- Scored, verified rows. Not granted to anon — wrappers below are.
-- ---------------------------------------------------------------
create or replace function public.waitlist_scored()
returns table (
  id uuid,
  referral_code text,
  created_at timestamptz,
  handle text,
  direct_count bigint,
  indirect_count bigint,
  points bigint,
  rank bigint
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with verified as (
    select w.*
    from public.waitlist w
    where w.verified_at is not null
      and w.referral_code is not null
  ),
  featured as (
    -- Public board: 0x + 40 hex only. Invites still count from every verified signup.
    select v.*
    from verified v
    where v.wallet_address ~* '^0x[0-9a-f]{40}$'
  ),
  directs as (
    select referred_by as id, count(*)::bigint as n
    from verified
    where referred_by is not null
    group by referred_by
  ),
  indirects as (
    select parent.referred_by as id, count(*)::bigint as n
    from verified child
    join verified parent on child.referred_by = parent.id
    where parent.referred_by is not null
    group by parent.referred_by
  ),
  scored as (
    select
      f.id,
      f.referral_code,
      f.created_at,
      substring(f.wallet_address from 1 for 6) || '…' || substring(f.wallet_address from 39 for 4) as handle,
      coalesce(d.n, 0) as direct_count,
      coalesce(i.n, 0) as indirect_count,
      coalesce(d.n, 0) * 10 + coalesce(i.n, 0) * 2 as points
    from featured f
    left join directs d on d.id = f.id
    left join indirects i on i.id = f.id
  )
  select
    id,
    referral_code,
    created_at,
    handle,
    direct_count,
    indirect_count,
    points,
    row_number() over (order by points desc, created_at asc)::bigint as rank
  from scored;
$$;

create or replace function public.waitlist_share_payload(
  v_row public.waitlist,
  v_status text
)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with counts as (
    select
      (select count(*) from public.waitlist d
        where d.referred_by = v_row.id and d.verified_at is not null) as direct_count,
      (select count(*) from public.waitlist i
        where i.verified_at is not null
          and i.referred_by in (
            select d.id from public.waitlist d
            where d.referred_by = v_row.id and d.verified_at is not null
          )) as indirect_count
  )
  select jsonb_build_object(
    'status', v_status,
    'referral_code', v_row.referral_code,
    'direct_count', counts.direct_count,
    'indirect_count', counts.indirect_count,
    'points', counts.direct_count * 10 + counts.indirect_count * 2,
    'rank', s.rank,
    'handle', coalesce(
      s.handle,
      case
        when v_row.wallet_address ~* '^0x[0-9a-f]{40}$' then
          substring(v_row.wallet_address from 1 for 6) || '…' || substring(v_row.wallet_address from 39 for 4)
        else
          'hfzy-' || coalesce(v_row.referral_code, 'pending')
      end
    )
  )
  from counts
  left join public.waitlist_scored() s on s.id = v_row.id;
$$;

-- Finish a signup. Email comes from the OTP session, not the client body,
-- so a made-up address that never received the code cannot join.
create or replace function public.confirm_waitlist(
  p_wallet text default null,
  p_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(nullif(trim(both from coalesce(auth.jwt() ->> 'email', '')), ''));
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

-- Old client path. Do not insert: unverified inserts were the squat vector.
create or replace function public.join_waitlist(
  p_email text,
  p_wallet text default null,
  p_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(both from coalesce(p_email, '')));
  v_row public.waitlist%rowtype;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  select * into v_row
  from public.waitlist
  where lower(email) = v_email
    and verified_at is not null
  limit 1;

  if found then
    return public.waitlist_share_payload(v_row, 'already');
  end if;

  raise exception 'verification required' using errcode = '28000';
end;
$$;

create or replace function public.waitlist_referral_stats(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_row public.waitlist%rowtype;
begin
  if p_code is null or length(trim(p_code)) = 0 then
    return null;
  end if;
  select * into v_row
  from public.waitlist
  where referral_code = lower(trim(p_code))
    and verified_at is not null;
  if not found then
    return null;
  end if;
  return public.waitlist_share_payload(v_row, 'ok');
end;
$$;

-- Top 50 by points. Rank is among verified signups with a valid EVM wallet.
create or replace function public.waitlist_leaderboard()
returns table (
  rank bigint,
  handle text,
  referral_code text,
  points bigint,
  direct_count bigint,
  indirect_count bigint
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    s.rank,
    s.handle,
    s.referral_code,
    s.points,
    s.direct_count,
    s.indirect_count
  from public.waitlist_scored() s
  order by s.rank
  limit 50;
$$;

-- Look up rank by email or EVM wallet. Returns the referral_code so they can share.
create or replace function public.waitlist_lookup_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_q text := lower(trim(both from coalesce(p_email, '')));
  v_row public.waitlist%rowtype;
  v_out jsonb;
  v_status text;
begin
  if v_q ~ '^0x[0-9a-f]{40}$' then
    select * into v_row
    from public.waitlist
    where wallet_address = v_q
    limit 1;
  elsif v_q ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    select * into v_row
    from public.waitlist
    where lower(btrim(email)) = v_q
    limit 1;
  else
    return null;
  end if;

  if not found then
    return null;
  end if;

  if v_row.verified_at is null then
    v_status := 'unverified';
  elsif v_row.wallet_address is null or v_row.wallet_address !~* '^0x[0-9a-f]{40}$' then
    v_status := 'no_wallet';
  else
    v_status := 'ok';
  end if;
  v_out := public.waitlist_share_payload(v_row, v_status);
  if v_out is null then
    return jsonb_build_object(
      'status', v_status,
      'referral_code', v_row.referral_code,
      'handle', coalesce(v_row.referral_code, 'pending'),
      'direct_count', 0,
      'indirect_count', 0,
      'points', 0,
      'rank', null
    );
  end if;
  return v_out;
end;
$$;

-- Pre-check before sending an OTP. Does not return invite codes.
create or replace function public.waitlist_check(p_email text, p_wallet text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_email text := lower(trim(both from coalesce(p_email, '')));
  v_wallet text := nullif(lower(trim(both from coalesce(p_wallet, ''))), '');
  v_by_email uuid;
  v_by_wallet uuid;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if v_wallet is not null and v_wallet !~ '^0x[0-9a-f]{40}$' then
    raise exception 'invalid wallet' using errcode = '22023';
  end if;

  select id into v_by_email
  from public.waitlist
  where lower(btrim(email)) = v_email
  limit 1;

  if v_wallet is not null then
    select id into v_by_wallet
    from public.waitlist
    where wallet_address = v_wallet
    limit 1;
  end if;

  if v_by_wallet is not null and (v_by_email is null or v_by_wallet <> v_by_email) then
    return jsonb_build_object('ok', false, 'reason', 'wallet');
  end if;
  if v_by_email is not null then
    return jsonb_build_object('ok', true, 'reason', 'email');
  end if;
  return jsonb_build_object('ok', true, 'reason', null);
end;
$$;

create or replace function public.waitlist_count()
returns bigint
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select count(*) from public.waitlist where verified_at is not null;
$$;

revoke all on function public.waitlist_scored() from public;
revoke all on function public.waitlist_share_payload(public.waitlist, text) from public;
revoke all on function public.confirm_waitlist(text, text) from public;
revoke all on function public.join_waitlist(text, text, text) from public;
revoke all on function public.waitlist_referral_stats(text) from public;
revoke all on function public.waitlist_leaderboard() from public;
revoke all on function public.waitlist_lookup_email(text) from public;
revoke all on function public.waitlist_check(text, text) from public;
revoke all on function public.waitlist_count() from public;

grant execute on function public.confirm_waitlist(text, text) to anon, authenticated;
grant execute on function public.join_waitlist(text, text, text) to anon, authenticated;
grant execute on function public.waitlist_referral_stats(text) to anon, authenticated;
grant execute on function public.waitlist_leaderboard() to anon, authenticated;
grant execute on function public.waitlist_lookup_email(text) to anon, authenticated;
grant execute on function public.waitlist_check(text, text) to anon, authenticated;
grant execute on function public.waitlist_count() to anon, authenticated;

-- PostgREST caches function signatures. Without this, a newly added
-- waitlist_lookup_email() 404s from the API even though the SQL ran.
notify pgrst, 'reload schema';
