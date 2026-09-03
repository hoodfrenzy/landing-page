"use client";

import { useState } from "react";
import {
  DIRECT_POINTS,
  INDIRECT_POINTS,
  referralUrl,
  twitterShareUrl,
} from "@/lib/referrals";

export default function ReferralShare({
  code,
  points,
  directCount,
  indirectCount,
  compact = false,
}: {
  code: string;
  points?: number;
  directCount?: number;
  indirectCount?: number;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const url = referralUrl(code);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div>
        <p className="text-xs uppercase tracking-wide text-[#71717a]">Your invite link</p>
        <div className="mt-2 flex items-stretch gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl border border-[#252525] bg-[#111111] px-3 py-2.5 font-mono text-xs text-[#e4e4e7] sm:text-sm">
            {url}
          </code>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-xl border border-[#252525] bg-[#111111] px-3 py-2 text-xs font-medium text-white transition-colors hover:border-[#3f3f46]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <a
        href={twitterShareUrl(code)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ECE3D1] px-4 py-3 text-sm font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90"
      >
        <XLogo />
        Share on X
      </a>

      {(points != null || directCount != null) && (
        <p className="text-center text-xs text-[#71717a]">
          {points ?? 0} pts
          {directCount != null ? ` · ${directCount} direct` : ""}
          {indirectCount != null ? ` · ${indirectCount} second-degree` : ""}
        </p>
      )}

      {!compact && (
        <p className="text-center text-[11px] leading-relaxed text-[#52525b]">
          {DIRECT_POINTS} points for every person who joins with your link.
          {INDIRECT_POINTS} points when they refer someone.
        </p>
      )}
    </div>
  );
}

function XLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
