import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Null when the env vars are missing, so the landing page still renders
 * (and the form degrades to a clear error) instead of crashing the build.
 */
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, { auth: { persistSession: false } })
    : null;

export const supabaseConfigured = Boolean(url && anonKey);
