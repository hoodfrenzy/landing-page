"use client";

import { useEffect } from "react";
import { captureRefFromLocation } from "@/lib/referrals";
import { openEarlyAccess } from "@/lib/earlyAccess";

/** Persist ?ref= / /r/CODE and, on an inbound invite, open the waitlist. */
export default function ReferralCapture({ openWaitlist = false }: { openWaitlist?: boolean }) {
  useEffect(() => {
    const captured = captureRefFromLocation(window.location.search, window.location.pathname);
    if (captured && openWaitlist) {
      const t = window.setTimeout(() => openEarlyAccess(), 500);
      return () => window.clearTimeout(t);
    }
  }, [openWaitlist]);
  return null;
}
