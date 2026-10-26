import "server-only";
import { getAccessToken } from "@/lib/google/access-token";
import { publishLibrary } from "@/lib/publish/run";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSync } from "./run";
import { needsSync, SIGN_IN_NEEDED, type SyncTrigger } from "./schedule";

// One full sync for one teacher, with their own token: read Classroom, copy
// Drive files into their library folder, fetch card pictures. Never throws;
// the outcome (including "sign in again") goes to sync_state.
export async function syncNow(userId: string, domain: string, trigger: SyncTrigger): Promise<void> {
  const admin = createAdminClient();
  try {
    const token = await getAccessToken(userId);
    if (token.status !== "ok") {
      await admin.from("sync_state").upsert({
        user_id: userId,
        last_trigger: trigger,
        last_finished_at: new Date().toISOString(),
        last_error: token.status === "reconnect_required" ? SIGN_IN_NEEDED : "Couldn't reach Google. Try again in a minute.",
      });
      return;
    }
    await runSync(userId, domain, token.accessToken, trigger);
    await publishLibrary(userId, domain, token.accessToken);
  } catch (err) {
    console.error("[sync/auto] failed", { userId, trigger, error: err instanceof Error ? err.message : "unknown" });
  }
}

// Starts a sync only when the teacher's last one is older than the window and
// none is running. A duplicate that slips through is harmless: copies and
// pictures that exist are skipped.
export async function syncIfStale(
  userId: string,
  domain: string,
  trigger: SyncTrigger
): Promise<"ran" | "fresh" | "running"> {
  try {
    const { data } = await createAdminClient()
      .from("sync_state")
      .select("last_started_at, last_finished_at")
      .eq("user_id", userId)
      .maybeSingle();
    const state = needsSync({
      lastStartedAt: data?.last_started_at ?? null,
      lastFinishedAt: data?.last_finished_at ?? null,
      now: new Date(),
    });
    if (state !== "run") return state;
    await syncNow(userId, domain, trigger);
    return "ran";
  } catch (err) {
    console.error("[sync/auto] check failed", { userId, error: err instanceof Error ? err.message : "unknown" });
    return "fresh";
  }
}
