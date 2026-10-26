import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { syncNow } from "@/lib/sync/auto";
import { pickTeachersForNightly } from "@/lib/sync/schedule";
import { createAdminClient } from "@/lib/supabase/admin";

// Vercel Hobby crons run once a day each, so vercel.json has several entries
// for this path at different early-morning hours. Each call syncs a few of the
// stalest teachers and leaves the rest for the next entry.
//
// Hobby functions may run up to 300 seconds (Vercel docs, fluid compute). This
// one is capped at 120, and stops starting new teachers after 50 seconds, so a
// call stays well under the limit.
export const maxDuration = 120;

const BATCH_SIZE = 3;
const START_BUDGET_MS = 50_000;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const startedAt = Date.now();
  const admin = createAdminClient();
  const [{ data: users, error: usersError }, { data: states, error: statesError }] = await Promise.all([
    admin.from("users").select("id, domain"),
    admin.from("sync_state").select("user_id, last_started_at, last_finished_at, last_error"),
  ]);
  if (usersError || statesError) {
    console.error("[cron/sync] lookup failed", { users: usersError?.code, states: statesError?.code });
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }

  const stateById = new Map((states ?? []).map((s) => [s.user_id, s]));
  const domainById = new Map((users ?? []).map((u) => [u.id, u.domain]));
  const rows = (users ?? []).map((u) => {
    const s = stateById.get(u.id);
    return {
      userId: u.id,
      lastStartedAt: s?.last_started_at ?? null,
      lastFinishedAt: s?.last_finished_at ?? null,
      lastError: s?.last_error ?? null,
    };
  });

  const picked = pickTeachersForNightly(rows, new Date(), BATCH_SIZE);
  let synced = 0;
  for (const row of picked) {
    if (Date.now() - startedAt > START_BUDGET_MS) break;
    await syncNow(row.userId, domainById.get(row.userId)!, "nightly");
    synced += 1;
  }

  console.log(`[cron/sync] ${rows.length} teachers, ${picked.length} due, ${synced} synced`);
  return NextResponse.json({ teachers: rows.length, due: picked.length, synced });
}
