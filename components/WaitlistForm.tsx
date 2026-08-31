"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { WAITLIST_JOINED } from "./WaitlistStats";

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

type Status = "idle" | "sending" | "joined" | "already" | "error";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

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
    if (!supabase) {
      setStatus("error");
      setError("Waitlist isn't connected yet. Set the Supabase env vars.");
      return;
    }

    setStatus("sending");

    const { error: insertError } = await supabase.from("waitlist").insert({
      email: cleanEmail,
      wallet_address: cleanWallet ? cleanWallet.toLowerCase() : null,
    });

    if (!insertError) {
      setStatus("joined");
      window.dispatchEvent(new Event(WAITLIST_JOINED));
      return;
    }

    // 23505 = unique violation: this email or wallet is already signed up.
    if (insertError.code === "23505") {
      setStatus("already");
      return;
    }

    setStatus("error");
    setError("Something broke on our end. Try again in a moment.");
  }

  if (status === "joined" || status === "already") {
    return (
      <div className="mx-auto flex max-w-md items-center justify-center gap-3 rounded-full border border-[#c8ff00]/30 bg-[#c8ff00]/[0.06] px-5 py-3 text-sm">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#c8ff00] shadow-[0_0_10px_#c8ff00]" />
        <span className="text-[#e4e4e7]">
          {status === "already"
            ? "You're already on the list — we'll be in touch."
            : "You're in. We'll ping you when the first curve opens."}
        </span>
      </div>
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
          {sending ? "Joining…" : "Join waitlist"}
        </button>
      </div>

      <p
        className={`mt-3 text-center text-xs ${
          error ? "text-[#ef4444]" : "text-[#71717a]"
        }`}
      >
        {error || "Paste a wallet to be queued for launch-day access. No spam."}
      </p>

      <p className="mt-4 border-t border-[#1a1a1a] pt-4 text-center text-[11px] leading-relaxed text-[#52525b]">
        Memecoins are volatile and can go to zero. Leverage amplifies losses as
        well as gains. Nothing here is investment advice.
      </p>
    </form>
  );
}
