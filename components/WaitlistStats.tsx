"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Fired by WaitlistForm after a successful signup so the counter refreshes. */
export const WAITLIST_JOINED = "waitlist:joined";

export default function WaitlistStats() {
  const [count, setCount] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!supabase) return;
    supabase.rpc("waitlist_count").then(({ data, error }) => {
      if (error || data == null) return;
      setCount(Number(data));
    });
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(WAITLIST_JOINED, load);
    return () => window.removeEventListener(WAITLIST_JOINED, load);
  }, [load]);

  return (
    <dl className="flex items-start gap-10 sm:gap-14">
      <div>
        <dt className="text-sm text-[#71717a]">Waitlisted</dt>
        <dd className="mt-1 text-2xl font-medium tabular-nums text-[#fafafa] sm:text-3xl">
          {count === null ? (
            <span className="text-[#3f3f46]">—</span>
          ) : (
            count.toLocaleString()
          )}
        </dd>
      </div>
      <div>
        <dt className="text-sm text-[#71717a]">Leverage</dt>
        <dd className="mt-1 text-2xl font-medium text-[#fafafa] sm:text-3xl">
          Up to <span className="text-[#c8ff00]">2×</span>
        </dd>
      </div>
    </dl>
  );
}
