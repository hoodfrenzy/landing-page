"use client";

import Link from "next/link";
import EarlyAccessTrigger from "./EarlyAccessTrigger";

export default function SiteNav({ active }: { active?: "home" | "leaderboard" }) {
  return (
    <nav className="shrink-0 px-6 py-5">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <img src="/Frame 10.svg" alt="hoodfrenzy" className="h-7 w-7" />
          <img src="/wordmark.svg" alt="hoodfrenzy" className="h-5" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/leaderboard"
            className={`rounded-full px-4 py-2 text-sm transition-colors ${
              active === "leaderboard"
                ? "bg-white/10 text-white"
                : "text-[#a1a1aa] hover:text-white"
            }`}
          >
            Leaderboard
          </Link>
          <EarlyAccessTrigger className="rounded-full bg-[#c8ff00] px-5 py-2.5 text-sm font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90" />
        </div>
      </div>
    </nav>
  );
}
