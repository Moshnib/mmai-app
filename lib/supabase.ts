import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser/public client — uses the anon key, which Row Level Security
// restricts to read-only (see supabase/schema.sql). Safe to expose to the client.
// Cached as a module-level singleton: calling createClient() more than once
// spins up a duplicate GoTrueClient (Supabase Auth) instance per call, which
// logs "Multiple GoTrueClient instances detected" — this avoids that.
let publicClient: SupabaseClient | null = null;

export function getPublicSupabaseClient() {
  if (publicClient) return publicClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Set these in .env.local (see .env.local.example)."
    );
  }
  publicClient = createClient(url, anonKey);
  return publicClient;
}

// Server-only client — uses the service role key, which bypasses Row Level
// Security. NEVER import this file into a Client Component or expose this
// key with a NEXT_PUBLIC_ prefix — it must only run in API routes / server code.
export function getServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set these as server-only environment variables."
    );
  }
  return createClient(url, serviceKey);
}
