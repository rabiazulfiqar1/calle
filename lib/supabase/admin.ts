import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * ADMIN client — uses the service role key, bypasses Row Level Security.
 * Server-side ONLY. Never import this in a client component or expose
 * its key to the browser. Used exclusively for infrastructure-level data
 * (like the shared CALL-E broker token) that no individual user should
 * read or write directly, regardless of their own auth status.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}