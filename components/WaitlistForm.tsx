"use client";

import { useState } from "react";
import Link from "next/link";
import { WAITLIST_JOINED } from "./WaitlistStats";
import ReferralShare from "./ReferralShare";
import { checkWaitlistTaken, sendWaitlistOtp, verifyWaitlistOtp } from "@/lib/waitlistApi";
import {
  readInboundRef,
  writeMyCode,
  writePendingJoin,
  clearPendingJoin,
} from "@/lib/referrals";
import type { JoinResult } from "@/lib/referrals";

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

type Status = "idle" | "sending" | "code" | "verifying" | "joined" | "already" | "error";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [wallet, setWallet] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<JoinResult | null>(null);
  const [alreadyOnList, setAlreadyOnList] = useState(false);

  function pending() {
    return {
      email: email.trim().toLowerCase(),
      wallet: wallet.trim() ? wallet.trim().toLowerCase() : null,
      ref: readInboundRef(),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanWallet = wallet.trim();

    if (!cleanEmail) return;
    if (cleanWallet && !WALLET_RE.test(cleanWallet)) {
      setStatus("error");
      setError("That doesn't look like an EVM address — expected 0x + 40 characters.");
      return;
    }

    setStatus("sending");
    setAlreadyOnList(false);
    const p = pending();
    const taken = await checkWaitlistTaken(p.email, p.wallet);
    if (taken.error && taken.reason === "wallet") {
      setStatus("error");
      setError(taken.error);
      return;
    }
    if (taken.error && !taken.ok) {
      setStatus("error");
      setError(taken.error);
      return;
    }
    if (taken.reason === "email") setAlreadyOnList(true);
    writePendingJoin(p);
    const { error: sendError } = await sendWaitlistOtp(p);
    if (sendError) {
      setStatus("error");
      setError(sendError);
      return;
    }
    setStatus("code");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const token = code.trim();
    if (!token) return;
    setStatus("verifying");
    const p = pending();
    const result = await verifyWaitlistOtp({
      email: p.email,
      token,
      wallet: p.wallet,
      ref: p.ref,
    });
    if (result.error) {
      setStatus("code");
      setError(result.error);
      return;
    }
    finish(result.data, result.already);
  }

  function finish(data: JoinResult | null, already: boolean) {
    if (data?.referral_code) {
      writeMyCode(data.referral_code);
      setProfile(data);
    }
    clearPendingJoin();
    setStatus(already ? "already" : "joined");
    window.dispatchEvent(new Event(WAITLIST_JOINED));
  }

  if (status === "joined" || status === "already") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-3 rounded-full border border-[#c8ff00]/30 bg-[#c8ff00]/[0.06] px-5 py-3 text-sm">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#c8ff00] shadow-[0_0_10px_#c8ff00]" />
          <span className="text-[#e4e4e7]">
            {status === "already"
              ? "You're already on the list — here's your invite link."
              : "You're in. Share your link to climb the leaderboard."}
          </span>
        </div>
        {profile?.referral_code ? (
          <>
            <ReferralShare
              code={profile.referral_code}
              points={profile.points}
              directCount={profile.direct_count}
              indirectCount={profile.indirect_count}
            />
            <p className="text-center text-xs">
              <Link href="/leaderboard" className="text-[#c8ff00] hover:underline">
                See the leaderboard
              </Link>
            </p>
          </>
        ) : (
          <p className="text-center text-xs text-[#71717a]">
            We&apos;ll ping you when the first curve opens.
          </p>
        )}
      </div>
    );
  }

  if (status === "code" || status === "verifying") {
    const verifying = status === "verifying";
    return (
      <form onSubmit={handleVerify} className="w-full">
        <p className="mb-3 text-center text-sm text-[#a1a1aa]">
          {alreadyOnList ? (
            "This email is already on the list. Enter the code we sent to recover your invite."
          ) : (
            <>
              We sent a code to <span className="text-white">{email.trim().toLowerCase()}</span>.
              Enter it to prove the mailbox exists.
            </>
          )}
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
          placeholder="6-digit code"
          className="w-full rounded-xl border border-[#252525] bg-[#111111] px-4 py-3 text-center font-mono text-lg tracking-[0.4em] text-white transition-colors placeholder:tracking-normal placeholder:text-[#71717a] focus:border-[#c8ff00] focus:outline-none"
        />
        <button
          type="submit"
          disabled={verifying || code.trim().length < 6}
          className="mt-2.5 w-full rounded-xl bg-[#c8ff00] px-6 py-3 font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {verifying ? "Checking…" : "Confirm email"}
        </button>
        <p className={`mt-3 text-center text-xs ${error ? "text-[#ef4444]" : "text-[#71717a]"}`}>
          {error || "Didn't get it? Check spam, or resend."}
        </p>
        <div className="mt-2 flex justify-center gap-4 text-xs">
          <button
            type="button"
            className="text-[#a1a1aa] hover:text-white"
            onClick={async () => {
              setError("");
              const { error: sendError } = await sendWaitlistOtp(pending());
              if (sendError) setError(sendError);
            }}
          >
            Resend code
          </button>
          <button
            type="button"
            className="text-[#a1a1aa] hover:text-white"
            onClick={() => {
              setCode("");
              setError("");
              setStatus("idle");
            }}
          >
            Use a different email
          </button>
        </div>
      </form>
    );
  }

  const sending = status === "sending";

  return (
    <form id="waitlist" onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col gap-2.5">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="w-full rounded-xl border border-[#252525] bg-[#111111] px-4 py-3 text-white transition-colors placeholder:text-[#71717a] focus:border-[#c8ff00] focus:outline-none"
        />
        <input
          type="text"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="0x… wallet address (optional)"
          spellCheck={false}
          className="w-full rounded-xl border border-[#252525] bg-[#111111] px-4 py-3 font-mono text-sm text-white transition-colors placeholder:font-sans placeholder:text-[#71717a] focus:border-[#c8ff00] focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-xl bg-[#c8ff00] px-6 py-3 font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {sending ? "Sending code…" : "Send verification code"}
        </button>
      </div>

      <p className={`mt-3 text-center text-xs ${error ? "text-[#ef4444]" : "text-[#71717a]"}`}>
        {error || "We'll email a code — fake addresses don't get points."}
      </p>

      <p className="mt-4 border-t border-[#1a1a1a] pt-4 text-center text-[11px] leading-relaxed text-[#52525b]">
        Memecoins are volatile and can go to zero. Leverage amplifies losses as
        well as gains. Nothing here is investment advice.
      </p>
    </form>
  );
}
