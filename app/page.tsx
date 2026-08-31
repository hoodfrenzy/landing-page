import Scene from "@/components/Scene";
import HeroZoom from "@/components/HeroZoom";
import EarlyAccessTrigger from "@/components/EarlyAccessTrigger";
import EarlyAccessOverlay from "@/components/EarlyAccessOverlay";
import WaitlistStats from "@/components/WaitlistStats";

export default function LandingPage() {
  return (
    <div className="relative h-screen overflow-hidden bg-[#0a0a0a] text-white">
      {/* Dots + tokens share one camera and sit behind everything */}
      <Scene />

      <HeroZoom>
        <div className="relative z-20 flex h-full flex-col">
          {/* Nav */}
          <nav className="shrink-0 px-6 py-5">
            <div className="mx-auto flex max-w-7xl items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/Frame 10.svg" alt="hoodfrenzy" className="h-7 w-7" />
                <img src="/wordmark.svg" alt="hoodfrenzy" className="h-5" />
              </div>
              <EarlyAccessTrigger className="rounded-full bg-[#c8ff00] px-5 py-2.5 text-sm font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90" />
            </div>
          </nav>

          {/* Headline */}
          <div className="shrink-0 px-6 pt-6 sm:pt-10">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-3xl font-light leading-[1.15] tracking-tight sm:text-4xl md:text-5xl">
                Launch coins on Robinhood with{" "}
                <span className="whitespace-nowrap">
                  up to{" "}
                  <span className="font-normal text-[#c8ff00] [text-shadow:0_0_28px_rgba(200,255,0,0.35)]">
                    2×
                  </span>{" "}
                  leverage
                </span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-base font-light text-[#a1a1aa] sm:text-lg">
                Launching soon — join the waitlist for early access.
              </p>
            </div>
          </div>

          {/* The sphere lives in the fixed Scene behind this gap */}
          <div className="min-h-0 flex-1" />

          {/* Bottom bar */}
          <div className="shrink-0 px-6 pb-6 pt-2">
            <div className="mx-auto flex max-w-7xl items-end justify-between gap-6">
              <WaitlistStats />
              <span className="hidden text-sm text-[#71717a] sm:block">
                Robinhood Chain · 4663
              </span>
            </div>
          </div>
        </div>
      </HeroZoom>

      <EarlyAccessOverlay />
    </div>
  );
}
