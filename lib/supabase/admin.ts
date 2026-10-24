import "server-only";
import { createClient } from "@supabase/supabase-js";

// Secret-key client: bypasses RLS. Server only, and every caller scopes its
// queries to the signed-in teacher's id.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
