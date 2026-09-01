import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  const body = await request.json();
  const email = (body.email ?? "").trim().toLowerCase();
  const code = (body.code ?? "").trim();
  const wallet = body.wallet ?? null;
  const ref = body.ref ?? null;

  if (!email || !code) {
    return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  // Find matching code
  const { data: codes, error: lookupError } = await supabase
    .from("waitlist_codes")
    .select("id")
    .eq("email", email)
    .eq("code", code)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  if (lookupError) {
    console.error("Code lookup error:", lookupError);
    if ((lookupError as { code?: string }).code === "PGRST205") {
      return NextResponse.json(
        { error: "Server setup incomplete — run supabase/resend-otp.sql in Supabase SQL Editor, then retry." },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "Verification failed. Try again." }, { status: 500 });
  }

  if (!codes || codes.length === 0) {
    return NextResponse.json(
      { error: "That code is wrong or expired. Request a new one." },
      { status: 401 },
    );
  }

  // Mark code as used
  await supabase
    .from("waitlist_codes")
    .update({ used: true })
    .eq("id", codes[0].id);

  // Call confirm_waitlist with p_email (new parameter)
  const { data, error } = await supabase.rpc("confirm_waitlist", {
    p_wallet: wallet,
    p_ref: ref,
    p_email: email,
  });

  if (error) {
    if (/not authenticated/i.test(error.message ?? "")) {
      return NextResponse.json({ error: "Verification failed. Try again." }, { status: 401 });
    }
    if (/invalid wallet/i.test(error.message ?? "")) {
      return NextResponse.json(
        { error: "That doesn't look like an EVM address — expected 0x + 40 characters." },
        { status: 400 },
      );
    }
    if (/wallet already registered/i.test(error.message ?? "")) {
      return NextResponse.json(
        { error: "That wallet is already on the waitlist." },
        { status: 409 },
      );
    }
    console.error("confirm_waitlist error:", error);
    return NextResponse.json({ error: "Something broke on our end. Try again." }, { status: 500 });
  }

  const row = data as {
    status: string;
    referral_code: string | null;
    direct_count: number;
    indirect_count: number;
    points: number;
    rank: number | null;
    handle: string | null;
  };

  return NextResponse.json({
    ok: true,
    already: row?.status === "already",
    data: row,
  });
}
