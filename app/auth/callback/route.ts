import { after, NextResponse, type NextRequest } from "next/server";
import { emailDomain } from "@/lib/domain";
import { NEXT_COOKIE, safeNext, welcomePath, welcomeStep } from "@/lib/onboarding/gate";
import { encrypt, getTokenKey } from "@/lib/crypto";
import { SIGN_IN_NEEDED, SIGN_IN_REJECTED } from "@/lib/sync/schedule";
import { missingScopes } from "@/lib/google/scopes";
import { refreshAccessToken } from "@/lib/google/token";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { syncNow } from "@/lib/sync/auto";

function toLogin(request: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`/login?${query}`, request.url));
}

// Google sends the teacher to Supabase, which sends them here with a code.
// The session's provider_refresh_token exists only on this one response, and
// Supabase doesn't keep it, so it's encrypted and saved before we return.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return toLogin(request, request.nextUrl.searchParams.get("error") ? "error=denied" : "error=failed");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    console.error("[auth/callback] code exchange failed", { code: error?.code });
    return toLogin(request, "error=failed");
  }

  const { session } = data;
  const user = session.user;
  const refreshToken = session.provider_refresh_token;

  // Without a refresh token, sync would work once and then die.
  if (!refreshToken) {
    await supabase.auth.signOut();
    return toLogin(request, "reconnect=1");
  }

  // Using the refresh token now proves it works, and the token response says
  // which scopes were really granted (the consent screen lets teachers
  // untick them).
  const refreshed = await refreshAccessToken(refreshToken, user.id);
  if (refreshed.status !== "ok") {
    await supabase.auth.signOut();
    return toLogin(request, refreshed.status === "reconnect_required" ? "reconnect=1" : "error=failed");
  }
  if (missingScopes(refreshed.scopes).length > 0) {
    await supabase.auth.signOut();
    return toLogin(request, "error=scopes");
  }

  const email = user.email;
  if (!email) {
    await supabase.auth.signOut();
    return toLogin(request, "error=failed");
  }
  let domain: string;
  try {
    domain = emailDomain(email);
  } catch {
    await supabase.auth.signOut();
    return toLogin(request, "error=failed");
  }

  const admin = createAdminClient();
  const name = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? null) as string | null;

  const { data: profile, error: userError } = await admin
    .from("users")
    .upsert({ id: user.id, email, name, domain })
    .select("school_id, onboarded_at")
    .single();
  if (userError) {
    console.error("[auth/callback] user upsert failed", { userId: user.id, code: userError.code });
    await supabase.auth.signOut();
    return toLogin(request, "error=failed");
  }

  const { error: tokenError } = await admin.from("google_tokens").upsert({
    user_id: user.id,
    refresh_token_enc: encrypt(refreshToken, getTokenKey()),
    scopes: refreshed.scopes,
    updated_at: new Date().toISOString(),
  });
  if (tokenError) {
    console.error("[auth/callback] token save failed", { userId: user.id, code: tokenError.code });
    await supabase.auth.signOut();
    return toLogin(request, "error=failed");
  }

  // A fresh sign-in fixes a "sign in again" sync error: clear it, and the
  // sync timestamps, so the next page load syncs straight away.
  await admin
    .from("sync_state")
    .update({ last_error: null, last_started_at: null, last_finished_at: null })
    .eq("user_id", user.id)
    .in("last_error", [SIGN_IN_NEEDED, SIGN_IN_REJECTED]);

  // A lesson link the teacher opened while signed out (proxy.ts).
  const next = safeNext(request.cookies.get(NEXT_COOKIE)?.value);
  const step = welcomeStep({ onboardedAt: profile?.onboarded_at, schoolId: profile?.school_id });

  let target = next ?? "/lessons";
  if (step !== "done") {
    // Onboarding: read her classes and assignments now, while she answers.
    // Read only: nothing is copied and no pictures are fetched until she has
    // chosen which classes to share (the classes screen starts the full sync).
    after(() => syncNow(user.id, domain, "onboarding", { publish: false }));
    target = welcomePath(step, next);
  }

  const response = NextResponse.redirect(new URL(target, request.url));
  response.cookies.delete(NEXT_COOKIE);
  return response;
}
