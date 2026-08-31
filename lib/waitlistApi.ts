import { supabase } from "./supabase";
import type { JoinResult, LeaderboardRow, PendingJoin } from "./referrals";

function siteOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

export async function sendWaitlistOtp(pending: PendingJoin): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: "Waitlist isn't connected yet. Set the Supabase env vars." };
  }
  const params = new URLSearchParams();
  if (pending.ref) params.set("ref", pending.ref);
  if (pending.wallet) params.set("wallet", pending.wallet);
  const qs = params.toString();
  const redirectTo = `${siteOrigin()}/verify${qs ? `?${qs}` : ""}`;

  const { error } = await supabase.auth.signInWithOtp({
    email: pending.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectTo,
    },
  });
  if (!error) return { error: null };
  if (/rate limit|too many/i.test(error.message)) {
    return { error: "Too many codes sent. Wait a minute and try again." };
  }
  if (/signups not allowed|email logins are disabled|unsupported/i.test(error.message)) {
    return { error: "Email login isn't enabled on this project. Turn on Email in Supabase Auth." };
  }
  return { error: "Couldn't send a code to that address. Check the email and try again." };
}

export async function verifyWaitlistOtp(opts: {
  email: string;
  token: string;
  wallet: string | null;
  ref: string | null;
}): Promise<{ data: JoinResult | null; already: boolean; error: string | null }> {
  if (!supabase) {
    return { data: null, already: false, error: "Waitlist isn't connected yet. Set the Supabase env vars." };
  }
  const { error: otpError } = await supabase.auth.verifyOtp({
    email: opts.email,
    token: opts.token.trim(),
    type: "email",
  });
  if (otpError) {
    if (/expired|invalid|token/i.test(otpError.message)) {
      return { data: null, already: false, error: "That code is wrong or expired. Request a new one." };
    }
    return { data: null, already: false, error: "Couldn't verify that code. Try again." };
  }
  return confirmWaitlist({ wallet: opts.wallet, ref: opts.ref });
}

export async function confirmWaitlist(opts: {
  wallet: string | null;
  ref: string | null;
}): Promise<{ data: JoinResult | null; already: boolean; error: string | null }> {
  if (!supabase) {
    return { data: null, already: false, error: "Waitlist isn't connected yet. Set the Supabase env vars." };
  }
  const { data, error } = await supabase.rpc("confirm_waitlist", {
    p_wallet: opts.wallet,
    p_ref: opts.ref,
  });
  if (!error && data) {
    const row = data as JoinResult;
    return { data: row, already: row.status === "already", error: null };
  }
  if (/not authenticated/i.test(error?.message ?? "")) {
    return { data: null, already: false, error: "Verify the code from your email first." };
  }
  if (/invalid wallet/i.test(error?.message ?? "")) {
    return { data: null, already: false, error: "That doesn't look like an EVM address — expected 0x + 40 characters." };
  }
  if (/wallet already registered/i.test(error?.message ?? "")) {
    return { data: null, already: false, error: "That wallet is already on the waitlist." };
  }
  if (error && isMissingRpc(error)) {
    return { data: null, already: false, error: "Verification isn't set up yet. Run supabase/referrals.sql." };
  }
  return { data: null, already: false, error: "Something broke on our end. Try again in a moment." };
}

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("waitlist_leaderboard");
  if (error || !data) return [];
  return (data as LeaderboardRow[])
    .map((r) => ({
      rank: Number(r.rank),
      handle: r.handle,
      referral_code: r.referral_code,
      points: Number(r.points),
      direct_count: Number(r.direct_count),
      indirect_count: Number(r.indirect_count),
    }))
    .filter((r) => r.handle.startsWith("0x"))
    .sort((a, b) => a.rank - b.rank || b.points - a.points)
    .slice(0, 50);
}

export async function fetchReferralStats(code: string): Promise<JoinResult | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("waitlist_referral_stats", { p_code: code });
  if (error || !data) return null;
  return data as JoinResult;
}

export async function checkWaitlistTaken(
  email: string,
  wallet: string | null,
): Promise<{ ok: boolean; reason: "email" | "wallet" | null; error: string | null }> {
  if (!supabase) return { ok: false, reason: null, error: "Waitlist isn't connected yet." };
  const { data, error } = await supabase.rpc("waitlist_check", {
    p_email: email.trim().toLowerCase(),
    p_wallet: wallet,
  });
  if (error) {
    if (/invalid wallet/i.test(error.message)) {
      return { ok: false, reason: null, error: "That doesn't look like an EVM address — expected 0x + 40 characters." };
    }
    if (isMissingRpc(error)) {
      return { ok: true, reason: null, error: null };
    }
    return { ok: false, reason: null, error: "Couldn't check that signup. Try again." };
  }
  const row = data as { ok?: boolean; reason?: "email" | "wallet" | null } | null;
  if (row?.ok === false && row.reason === "wallet") {
    return { ok: false, reason: "wallet", error: "That wallet is already on the waitlist." };
  }
  return { ok: true, reason: row?.reason === "email" ? "email" : null, error: null };
}

export async function lookupWaitlistEmail(
  email: string,
): Promise<{ data: JoinResult | null; error: string | null }> {
  if (!supabase) return { data: null, error: "Waitlist isn't connected yet." };
  const { data, error } = await supabase.rpc("waitlist_lookup_email", {
    p_email: email.trim().toLowerCase(),
  });
  // p_email is the query string: email or 0x wallet.
  if (error) {
    if (isMissingRpc(error)) {
      return { data: null, error: "Email lookup isn't set up yet. Re-run supabase/referrals.sql." };
    }
    return { data: null, error: "Couldn't look that up. Try again in a moment." };
  }
  if (!data) return { data: null, error: null };
  return { data: data as JoinResult, error: null };
}

function isMissingRpc(error: { code?: string; message?: string }): boolean {
  const msg = `${error.code ?? ""} ${error.message ?? ""}`;
  return /PGRST202|function.*(confirm_waitlist|join_waitlist|lookup_email|waitlist_check)|schema cache/i.test(msg);
}
