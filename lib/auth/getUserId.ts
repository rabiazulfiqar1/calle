import { createClient } from "@/lib/supabase/server";

/** Returns the signed-in user's ID, or null if not authenticated. */
export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}