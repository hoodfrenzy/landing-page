import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import EarlyAccessOverlay from "@/components/EarlyAccessOverlay";
import Leaderboard from "@/components/Leaderboard";
import ReferralCapture from "@/components/ReferralCapture";

export const metadata: Metadata = {
  title: "Leaderboard — levera",
  description:
    "Earn 10 XP for every invite, 2 XP when they invite someone.",
};

export default function LeaderboardPage() {
  return (
    <div className="min-h-full bg-[#131514] text-white">
      <ReferralCapture />
      <SiteNav active="leaderboard" />
      <Leaderboard />
      <EarlyAccessOverlay />
    </div>
  );
}
