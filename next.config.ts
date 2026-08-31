import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root. Without this, Turbopack walks up looking for a
  // lockfile and can latch onto one outside the repo (e.g. a stray
  // package-lock.json in the home directory), which it then warns about and
  // ignores. cwd is the project dir both in `next dev` and in a Vercel build.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
