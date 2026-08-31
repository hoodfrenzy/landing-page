"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import WaitlistForm from "./WaitlistForm";
import {
  EARLY_ACCESS_OPEN,
  broadcastEarlyAccessState,
} from "@/lib/earlyAccess";

export default function EarlyAccessOverlay() {
  const [mounted, setMounted] = useState(false); // in the DOM
  const [shown, setShown] = useState(false); // transitioned in
  const restoreFocus = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setShown(false);
    broadcastEarlyAccessState(false);
    // keep it mounted until the exit transition finishes
    window.setTimeout(() => setMounted(false), 400);
    restoreFocus.current?.focus();
  }, []);

  useEffect(() => {
    function onOpen() {
      restoreFocus.current = document.activeElement as HTMLElement | null;
      setMounted(true);
      broadcastEarlyAccessState(true);
      // next frame, so the entry transition actually runs
      requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    }
    window.addEventListener(EARLY_ACCESS_OPEN, onOpen);
    return () => window.removeEventListener(EARLY_ACCESS_OPEN, onOpen);
  }, []);

  // Escape to close, and lock background scroll while open.
  useEffect(() => {
    if (!mounted) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mounted, close]);

  // Focus the first field once the panel has arrived.
  useEffect(() => {
    if (!shown) return;
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLInputElement>("input[type=email]")?.focus();
    }, 420);
    return () => window.clearTimeout(t);
  }, [shown]);

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Get early access"
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{
        opacity: shown ? 1 : 0,
        background:
          "radial-gradient(circle at 50% 50%, rgba(5,5,5,0.72) 0%, rgba(5,5,5,0.5) 45%, rgba(5,5,5,0.75) 100%)",
        transition: shown
          ? "opacity 620ms ease-out 380ms"
          : "opacity 300ms ease-in",
      }}
      onClick={close}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 mx-6 w-full max-w-md"
        style={{
          // arrives as if the camera kept flying forward past the sphere
          transform: shown ? "scale(1)" : "scale(1.6)",
          opacity: shown ? 1 : 0,
          transition:
            "transform 820ms cubic-bezier(0.16,1,0.3,1) 420ms, opacity 520ms ease-out 470ms",
        }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute -top-12 right-0 flex h-9 w-9 items-center justify-center rounded-full border border-[#252525] bg-[#111111] text-[#a1a1aa] transition-colors hover:border-[#3f3f46] hover:text-white"
        >
          ✕
        </button>

        <div className="max-h-[90vh] overflow-y-auto rounded-2xl border border-[#1f1f1f] bg-[#0b0b0b]/90 p-7 shadow-[0_0_80px_rgba(200,255,0,0.06)] backdrop-blur-sm">
          <div className="mb-6 text-center">
            <img
              src="/Frame 10.svg"
              alt=""
              className="mx-auto mb-4 h-10 w-10"
              style={{
                filter:
                  "drop-shadow(0 0 6px rgba(200,255,0,0.8)) drop-shadow(0 0 20px rgba(200,255,0,0.35))",
              }}
            />
            <h2 className="text-xl font-medium text-white">Get early access</h2>
            <p className="mt-2 text-sm text-[#a1a1aa]">
              Launching soon. Join the waitlist and we&apos;ll open the first
              curves to you before anyone else.
            </p>
          </div>

          <WaitlistForm />
        </div>
      </div>
    </div>
  );
}
