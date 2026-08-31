import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import EarlyAccessOverlay from "@/components/EarlyAccessOverlay";
import EarlyAccessTrigger from "@/components/EarlyAccessTrigger";
import ReferralCapture from "@/components/ReferralCapture";
import { sanitizeCode } from "@/lib/referrals";

const title = "Join me on hoodfrenzy";
const description =
  "Launch coins on Robinhood with up to 2× leverage. Join the waitlist with this invite.";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const clean = sanitizeCode(code) ?? code;
  const path = `/r/${encodeURIComponent(clean)}`;
  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "hoodfrenzy",
      title,
      description,
      url: path,
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: "hoodfrenzy — launch coins on Robinhood with up to 2× leverage",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
  };
}

export default async function ReferralInvitePage({ params }: Props) {
  const { code } = await params;
  const clean = sanitizeCode(code);
  if (!clean) notFound();

  return (
    <div className="min-h-full bg-[#0a0a0a] text-white">
      <ReferralCapture openWaitlist />
      <SiteNav />
      <main className="mx-auto flex w-full max-w-lg flex-col items-center px-6 py-16 text-center">
        <img src="/Frame 10.svg" alt="" className="h-14 w-14" />
        <p className="mt-6 text-xs uppercase tracking-[0.2em] text-[#c8ff00]">You&apos;re invited</p>
        <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl">
          Launch coins on Robinhood with up to{" "}
          <span className="text-[#c8ff00]">2×</span> leverage
        </h1>
        <p className="mt-4 text-sm text-[#a1a1aa]">
          Someone saved you a spot on the hoodfrenzy waitlist. Join and you get your own
          invite link — 10 points per referral, 2 points when they refer too.
        </p>
        <EarlyAccessTrigger className="mt-8 rounded-full bg-[#c8ff00] px-6 py-3 text-sm font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90" />
        <Link href="/leaderboard" className="mt-4 text-sm text-[#a1a1aa] hover:text-white">
          See the leaderboard
        </Link>
        <p className="mt-6 font-mono text-xs text-[#52525b]">invite {clean}</p>
      </main>
      <EarlyAccessOverlay />
    </div>
  );
}
