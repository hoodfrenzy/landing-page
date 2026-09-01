import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { promises as dns } from "dns";

const resend = new Resend(process.env.RESEND_API_KEY);

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  const body = await request.json();
  const email = (body.email ?? "").trim().toLowerCase();
  const wallet = body.wallet != null ? String(body.wallet).trim().toLowerCase() : null;
  const walletClean = wallet && wallet.length > 0 ? wallet : null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || email.includes("..")) {
    return NextResponse.json({ error: "That email address doesn't look valid. Check the spelling and try again." }, { status: 400 });
  }
  // Resend accepts any syntactically-valid address (even if domain doesn't exist) — do a quick MX/A check ourselves
  const domain = email.split("@")[1] ?? "";
  // Block obvious typos / test domains
  if (/^(test|example|invalid|localhost)$/i.test(domain) || !domain.includes(".")) {
    return NextResponse.json({ error: "That email domain doesn't look valid. Use a real mailbox like @gmail.com." }, { status: 400 });
  }
  try {
    const mx = await dns.resolveMx(domain).catch(() => null);
    if (!mx || mx.length === 0) {
      // No MX — fall back to A/AAAA; if neither exists, domain is not emailable
      const a = await dns.resolve(domain).catch(() => null);
      const aaaa = a ? a : await dns.resolve6(domain).catch(() => null);
      if (!aaaa || (Array.isArray(aaaa) && aaaa.length === 0)) {
        return NextResponse.json({ error: "That email domain doesn't exist. Check the spelling and try again." }, { status: 400 });
      }
    }
  } catch {
    // DNS hiccup — don't block, let Resend decide; we handle its 400/422 below
  }
  if (walletClean && !/^0x[0-9a-f]{40}$/.test(walletClean)) {
    return NextResponse.json({ error: "That doesn't look like an EVM address — expected 0x + 40 characters." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  // Look up wallet/email before sending mail — don't waste a Resend send
  // on a wallet that's already taken, and surface the error before we generate a code.
  try {
    const { data: checkData, error: checkError } = await supabase.rpc("waitlist_check", {
      p_email: email,
      p_wallet: walletClean,
    });
    if (checkError) {
      if (/invalid wallet/i.test(checkError.message ?? "")) {
        return NextResponse.json({ error: "That doesn't look like an EVM address — expected 0x + 40 characters." }, { status: 400 });
      }
      // If the RPC is missing (migrations not run), allow the send to proceed — the later insert will surface it
      if (!/PGRST202|schema cache/i.test(`${checkError.code ?? ""} ${checkError.message ?? ""}`)) {
        console.error("waitlist_check error:", checkError);
      }
    } else {
      const row = checkData as { ok?: boolean; reason?: "email" | "wallet" | null } | null;
      if (row?.ok === false && row.reason === "wallet") {
        return NextResponse.json({ error: "That wallet is already on the waitlist." }, { status: 409 });
      }
      // row.reason === "email" means the email is already verified — still allow sending a code
      // so the user can recover their invite link; don't block the email.
    }
  } catch (e) {
    console.error("waitlist_check failed:", e);
  }

  // Rate limit: max 1 code per 60 seconds per email
  const { data: recent } = await supabase
    .from("waitlist_codes")
    .select("id")
    .eq("email", email)
    .gt("created_at", new Date(Date.now() - 60_000).toISOString())
    .limit(1);

  if (recent && recent.length > 0) {
    return NextResponse.json(
      { error: "Too many codes sent. Wait a minute and try again." },
      { status: 429 },
    );
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString(); // 10 minutes

  const { error: insertError } = await supabase.from("waitlist_codes").insert({
    email,
    code,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error("Failed to store code:", insertError);
    if ((insertError as { code?: string }).code === "PGRST205") {
      return NextResponse.json(
        { error: "Server setup incomplete — run supabase/resend-otp.sql in Supabase SQL Editor, then retry." },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "Couldn't send a code. Try again." }, { status: 500 });
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "HoodFrenzy <onboarding@resend.dev>";
  const { error: sendError } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "Your HoodFrenzy verification code",
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 32px 0;">
        <p style="font-size: 14px; color: #666; margin: 0 0 8px;">Your verification code</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 0 0 24px; color: #000;">
          ${code}
        </p>
        <p style="font-size: 13px; color: #999; margin: 0;">
          This code expires in 10 minutes. If you didn't request this, ignore this email.
        </p>
      </div>
    `,
    text: `Your HoodFrenzy verification code is ${code}\nThis code expires in 10 minutes. If you didn't request this, ignore this email.`,
    headers: {
      "X-Entity-Ref-ID": `waitlist-${email}`,
    },
  });

  if (sendError) {
    console.error("Resend error:", sendError);
    const msg = (sendError as { message?: string; statusCode?: number })?.message ?? "";
    const status = (sendError as { statusCode?: number })?.statusCode;
    // Resend can tell when the `to` address is malformed or undeliverable — surface it instead of a generic error
    if (status === 400 || status === 422) {
      if (/invalid.*(email|to|recipient)|parse.*email|not a valid email|invalid.*domain/i.test(msg)) {
        await supabase.from("waitlist_codes").delete().eq("email", email).eq("code", code);
        return NextResponse.json(
          { error: "That email address doesn't look valid. Check the spelling and try again." },
          { status: 400 },
        );
      }
    }
    const code403 = status === 403;
    if (code403 && /verify a domain|testing emails/i.test(msg)) {
      // Clean up the just-inserted code so the user can retry immediately after fixing domain
      await supabase.from("waitlist_codes").delete().eq("email", email).eq("code", code);
      return NextResponse.json(
        {
          error:
            "Resend is in test mode — onboarding@resend.dev can only send to your own address (kehindeemmanuel406@gmail.com). Verify a domain at resend.com/domains and set RESEND_FROM_EMAIL in .env.local to an address on that domain (e.g. HoodFrenzy <noreply@yourdomain.com>), then restart the dev server.",
        },
        { status: 500 },
      );
    }
    // Include Resend's message for invalid recipients when available
    if (/invalid.*(to|recipient|email)/i.test(msg)) {
      await supabase.from("waitlist_codes").delete().eq("email", email).eq("code", code);
      return NextResponse.json({ error: msg || "That email address doesn't look valid." }, { status: 400 });
    }
    return NextResponse.json({ error: "Couldn't send a code. Check the email and try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
