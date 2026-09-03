const INBOUND_KEY = "hoodfrenzy:ref";
const MY_CODE_KEY = "hoodfrenzy:myCode";
const PENDING_KEY = "hoodfrenzy:pendingJoin";

export type PendingJoin = {
  email: string;
  wallet: string | null;
  ref: string | null;
};

export const DIRECT_POINTS = 10;
export const INDIRECT_POINTS = 2;
export const EVM_WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

export type JoinResult = {
  status: "joined" | "already" | "ok" | "unverified" | "no_wallet";
  referral_code?: string;
  direct_count: number;
  indirect_count: number;
  points: number;
  rank?: number | null;
  handle: string;
};

export type LeaderboardRow = {
  rank: number;
  handle: string;
  referral_code: string;
  points: number;
  direct_count: number;
  indirect_count: number;
};

export function readInboundRef(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(INBOUND_KEY);
  } catch {
    return null;
  }
}

export function writeInboundRef(code: string) {
  const clean = sanitizeCode(code);
  if (!clean) return;
  try {
    const mine = window.localStorage.getItem(MY_CODE_KEY);
    if (mine && mine === clean) return; // don't credit yourself
    window.localStorage.setItem(INBOUND_KEY, clean);
  } catch {
    // private mode
  }
}

export function readMyCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(MY_CODE_KEY);
  } catch {
    return null;
  }
}

export function writeMyCode(code: string) {
  const clean = sanitizeCode(code);
  if (!clean) return;
  try {
    window.localStorage.setItem(MY_CODE_KEY, clean);
  } catch {
    // private mode
  }
}

export function sanitizeCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const c = raw.trim().toLowerCase();
  if (!/^[a-z0-9]{4,16}$/.test(c)) return null;
  return c;
}

export function captureRefFromLocation(search: string, pathname?: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const fromQuery = sanitizeCode(params.get("ref"));
  if (fromQuery) {
    writeInboundRef(fromQuery);
    return fromQuery;
  }
  const parts = (pathname ?? "").split("/").filter(Boolean);
  if (parts[0] === "r" && parts[1]) {
    const fromPath = sanitizeCode(parts[1]);
    if (fromPath) {
      writeInboundRef(fromPath);
      return fromPath;
    }
  }
  return null;
}

export function referralPath(code: string): string {
  return `/r/${encodeURIComponent(code)}`;
}

export function referralUrl(code: string): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return `${origin}${referralPath(code)}`;
}

export function readPendingJoin(): PendingJoin | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingJoin;
    if (!parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingJoin(pending: PendingJoin) {
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // private mode
  }
}

export function clearPendingJoin() {
  try {
    window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // private mode
  }
}

export function twitterShareUrl(code: string): string {
  const url = referralUrl(code);
  const text = [
    "Levera is bringing a new way to launch and trade tokens on Robinhood Chain.",
    "",
    "Be among the first to access a 2× leveraged token launchpad.",
    "",
    "Join the waitlist ahead of launch. 🚀 — @levera",
  ].join("\n");
  const intent = new URL("https://x.com/intent/tweet");
  intent.searchParams.set("text", text);
  intent.searchParams.set("url", url);
  return intent.toString();
}
