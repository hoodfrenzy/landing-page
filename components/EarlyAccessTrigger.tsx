"use client";

import { openEarlyAccess } from "@/lib/earlyAccess";

export default function EarlyAccessTrigger({
  className,
  children = "Get early access",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button type="button" onClick={openEarlyAccess} className={className}>
      {children}
    </button>
  );
}
