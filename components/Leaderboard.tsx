"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReferralShare from "./ReferralShare";
import EarlyAccessTrigger from "./EarlyAccessTrigger";
import { fetchLeaderboard, fetchReferralStats, lookupWaitlistEmail } from "@/lib/waitlistApi";
import {
  DIRECT_POINTS,
  INDIRECT_POINTS,
  readMyCode,
  type JoinResult,
  type LeaderboardRow,
} from "@/lib/referrals";

export default function Leaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [me, setMe] = useState<JoinResult | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookup, setLookup] = useState<JoinResult | "missing" | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const code = readMyCode();
    let cancelled = false;
    (async () => {
      const list = await fetchLeaderboard();
      if (cancelled) return;
      setRows(list);
      if (!code) return;
      setMyCode(code);
      const mine = list.find((r) => r.referral_code === code);
      const profile = await fetchReferralStats(code);
      if (cancelled) return;
      if (profile) {
        setMe(profile);
        setMyRank(profile.rank ?? mine?.rank ?? null);
      } else if (mine) {
        setMyRank(mine.rank);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const query = lookupQuery.trim().toLowerCase();
    if (!query) return;
    setLooking(true);
    setLookup(null);
    setLookupError(null);
    const result = await lookupWaitlistEmail(query);
    if (result.error) setLookupError(result.error);
    else setLookup(result.data ?? "missing");
    setLooking(false);
  }

  const total = rows?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows ? rows.slice(safePage * pageSize, safePage * pageSize + pageSize) : [];
  const from = total === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(total, (safePage + 1) * pageSize);

  function changePageSize(next: 10 | 20 | 50) {
    setPageSize(next);
    setPage(0);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 pb-16">
      <header className="pt-4 text-center sm:pt-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#c8ff00]">Waitlist</p>
        <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl">Leaderboard</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-[#a1a1aa]">
          Earn {DIRECT_POINTS} XP for every person who joins with your invite, and {INDIRECT_POINTS}{" "}
          XP when they invite someone of their own.
        </p>
      </header>

      {me?.referral_code ? (
        <section className="rounded-2xl border border-[#1f1f1f] bg-[#0b0b0b] p-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#71717a]">You</p>
              <p className="mt-1 font-mono text-lg text-white">{me.handle}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-medium tabular-nums text-[#c8ff00]">{me.points}</p>
              <p className="text-xs text-[#71717a]">
                {myRank ? `Rank #${myRank}` : "Unranked"} · {me.direct_count} direct · {me.indirect_count}{" "}
                second-degree
              </p>
            </div>
          </div>
          <ReferralShare
            code={me.referral_code}
            points={me.points}
            directCount={me.direct_count}
            indirectCount={me.indirect_count}
            compact
          />
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#1f1f1f] bg-[#0b0b0b] p-6">
        <p className="text-xs uppercase tracking-wide text-[#71717a]">Find your rank</p>
        <form onSubmit={handleLookup} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            required
            value={lookupQuery}
            onChange={(e) => setLookupQuery(e.target.value)}
            placeholder="your email or 0x wallet"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-xl border border-[#252525] bg-[#111111] px-4 py-3 text-white transition-colors placeholder:text-[#71717a] focus:border-[#c8ff00] focus:outline-none"
          />
          <button
            type="submit"
            disabled={looking}
            className="rounded-xl bg-[#c8ff00] px-5 py-3 text-sm font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {looking ? "Looking…" : "Look up"}
          </button>
        </form>
        {lookupError ? (
          <p className="mt-3 text-sm text-[#ef4444]">{lookupError}</p>
        ) : lookup === "missing" ? (
          <p className="mt-3 text-sm text-[#a1a1aa]">
            No signup for that email or wallet.{" "}
            <EarlyAccessTrigger className="text-[#c8ff00] underline-offset-2 hover:underline">
              Join the waitlist
            </EarlyAccessTrigger>
            .
          </p>
        ) : lookup?.status === "unverified" ? (
          <p className="mt-3 text-sm text-[#a1a1aa]">
            That email is on the list but hasn&apos;t been verified, so it has no rank yet.{" "}
            <EarlyAccessTrigger className="text-[#c8ff00] underline-offset-2 hover:underline">
              Send a code
            </EarlyAccessTrigger>
            .
          </p>
        ) : lookup?.status === "no_wallet" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-[#a1a1aa]">
              You&apos;re on the waitlist ({lookup.points} XP) but the board only lists valid EVM
              wallets. You can still share your invite.
            </p>
            {lookup.referral_code ? <ReferralShare code={lookup.referral_code} compact /> : null}
          </div>
        ) : lookup ? (
          <div className="mt-4 space-y-4 rounded-xl border border-[#252525] bg-[#111111] px-4 py-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-sm text-white">{lookup.handle}</p>
                <p className="mt-1 text-xs text-[#71717a]">
                  {lookup.direct_count} direct · {lookup.indirect_count} second-degree
                  {(lookup.rank ?? 0) > 50 ? " · outside the top 50" : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-medium tabular-nums text-[#c8ff00]">
                  {lookup.rank ? `#${lookup.rank}` : "—"}
                </p>
                <p className="text-xs text-[#71717a]">{lookup.points} XP</p>
              </div>
            </div>
            {lookup.referral_code ? (
              <ReferralShare
                code={lookup.referral_code}
                points={lookup.points}
                directCount={lookup.direct_count}
                indirectCount={lookup.indirect_count}
                compact
              />
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#1f1f1f]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#111111] text-xs uppercase tracking-wide text-[#71717a]">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Player</th>
              <th className="px-4 py-3 font-medium text-right">Direct</th>
              <th className="hidden px-4 py-3 font-medium text-right sm:table-cell">2nd</th>
              <th className="px-4 py-3 font-medium text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[#3f3f46]">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[#71717a]">
                  No one on the board yet.{" "}
                  <EarlyAccessTrigger className="text-[#c8ff00] underline-offset-2 hover:underline">
                    Be first.
                  </EarlyAccessTrigger>
                </td>
              </tr>
            ) : (
              pageRows.map((r) => {
                const mine = myCode != null && r.referral_code === myCode;
                return (
                  <tr
                    key={r.referral_code}
                    className={`border-t border-[#1a1a1a] ${
                      mine ? "bg-[#c8ff00]/[0.06]" : "bg-[#0b0b0b]"
                    }`}
                  >
                    <td className="px-4 py-3 tabular-nums text-[#a1a1aa]">{r.rank}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white sm:text-sm">
                      {r.handle}
                      {mine ? <span className="ml-2 text-[10px] text-[#c8ff00]">you</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#a1a1aa]">
                      {r.direct_count}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-[#a1a1aa] sm:table-cell">
                      {r.indirect_count}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-[#c8ff00]">
                      {r.points}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {rows && rows.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-[#1a1a1a] bg-[#0b0b0b] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-[#71717a]">
              <span>Rows</span>
              <div className="flex rounded-lg border border-[#252525] p-0.5">
                {([10, 20, 50] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => changePageSize(n)}
                    className={`rounded-md px-2.5 py-1 tabular-nums transition-colors ${
                      pageSize === n ? "bg-[#c8ff00] text-[#0a0a0a]" : "text-[#a1a1aa] hover:text-white"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <p className="text-xs tabular-nums text-[#71717a]">
                {from}–{to} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={safePage <= 0}
                  onClick={() => setPage(safePage - 1)}
                  className="rounded-lg border border-[#252525] px-3 py-1.5 text-xs text-white transition-colors hover:border-[#3f3f46] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage(safePage + 1)}
                  className="rounded-lg border border-[#252525] px-3 py-1.5 text-xs text-white transition-colors hover:border-[#3f3f46] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <p className="text-center text-xs text-[#52525b]">
        Only users with wallet address are featured.{" "}
        <Link href="/" className="text-[#a1a1aa] hover:text-white">
          Back to home
        </Link>
      </p>
    </div>
  );
}
