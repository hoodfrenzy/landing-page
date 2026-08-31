"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import ReferralShare from "@/components/ReferralShare";
import EarlyAccessOverlay from "@/components/EarlyAccessOverlay";
import { confirmWaitlist } from "@/lib/waitlistApi";
import {
  clearPendingJoin,
  readInboundRef,
  readPendingJoin,
  sanitizeCode,
  writeMyCode,
  type JoinResult,
} from "@/lib/referrals";
import { WAITLIST_JOINED } from "@/components/WaitlistStats";
import { supabase } from "@/lib/supabase";

type Phase = "working" | "joined" | "already" | "error";

export default function VerifyPage() {
  const [phase, setPhase] = useState<Phase>("working");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<JoinResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) {
        setPhase("error");
        setError("Waitlist isn't connected yet.");
        return;
      }
      // Magic-link callback puts tokens in the hash; give the client a tick to parse them.
      await new Promise((r) => setTimeout(r, 50));
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setPhase("error");
        setError("This link is invalid or expired. Request a new code from the waitlist form.");
        return;
      }
      const pending = readPendingJoin();
      const params = new URLSearchParams(window.location.search);
      const wallet = pending?.wallet ?? params.get("wallet");
      const ref =
        pending?.ref ??
        sanitizeCode(params.get("ref")) ??
        readInboundRef();
      const result = await confirmWaitlist({
        wallet: wallet && wallet.length > 0 ? wallet : null,
        ref,
      });
      if (cancelled) return;
      if (result.error || !result.data) {
        setPhase("error");
        setError(result.error ?? "Couldn't finish signup.");
        return;
      }
      if (result.data.referral_code) writeMyCode(result.data.referral_code);
      clearPendingJoin();
      setProfile(result.data);
      setPhase(result.already ? "already" : "joined");
      window.dispatchEvent(new Event(WAITLIST_JOINED));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-full bg-[#0a0a0a] text-white">
      <SiteNav />
      <main className="mx-auto w-full max-w-md px-6 py-16">
        {phase === "working" ? (
          <p className="text-center text-sm text-[#a1a1aa]">Confirming your email…</p>
        ) : null}

        {phase === "error" ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-[#ef4444]">{error}</p>
            <Link href="/" className="text-sm text-[#c8ff00] hover:underline">
              Back to the waitlist
            </Link>
          </div>
        ) : null}

        {phase === "joined" || phase === "already" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 rounded-full border border-[#c8ff00]/30 bg-[#c8ff00]/[0.06] px-5 py-3 text-sm">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#c8ff00] shadow-[0_0_10px_#c8ff00]" />
              <span className="text-[#e4e4e7]">
                {phase === "already"
                  ? "This email is already verified."
                  : "Email verified. You're on the list."}
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
            ) : null}
          </div>
        ) : null}
      </main>
      <EarlyAccessOverlay />
    </div>
  );
}
