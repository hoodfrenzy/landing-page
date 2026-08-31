"use client";

import { useEffect, useState } from "react";
import { EARLY_ACCESS_STATE } from "@/lib/earlyAccess";

/**
 * Pushes the whole hero toward the camera when the overlay opens. The sphere
 * inside scales again on top of this (see HeroSphere), so it travels faster
 * than the text around it -- cheap parallax that sells the forward motion.
 */
export default function HeroZoom({ children }: { children: React.ReactNode }) {
  const [zooming, setZooming] = useState(false);

  useEffect(() => {
    function onState(e: Event) {
      setZooming((e as CustomEvent<boolean>).detail);
    }
    window.addEventListener(EARLY_ACCESS_STATE, onState);
    return () => window.removeEventListener(EARLY_ACCESS_STATE, onState);
  }, []);

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{
        transform: zooming ? "scale(1.18)" : "scale(1)",
        opacity: zooming ? 0 : 1,
        transformOrigin: "50% 46%", // the sphere's centre, not the page's
        transition: zooming
          ? "transform 700ms cubic-bezier(0.66,0,0.86,0), opacity 460ms ease-in"
          : "transform 600ms cubic-bezier(0.16,1,0.3,1), opacity 450ms ease-out 120ms",
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}
