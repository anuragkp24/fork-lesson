import "server-only";
import { decrypt, getTokenKey } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken } from "./token";

export type AccessTokenResult =
  | { status: "ok"; accessToken: string }
  | { status: "reconnect_required"; reason: string }
  | { status: "error"; reason: string };

// Access tokens live in memory only, never in the database or a cookie.
const cache = new Map<string, { accessToken: string; expiresAt: number }>();
const EXPIRY_MARGIN_MS = 60_000;

export async function getAccessToken(userId: string): Promise<AccessTokenResult> {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return { status: "ok", accessToken: cached.accessToken };
  }

  const { data, error } = await createAdminClient()
    .from("google_tokens")
    .select("refresh_token_enc")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[google/access-token] token lookup failed", { userId, code: error.code });
    return { status: "error", reason: "lookup_failed" };
  }
  if (!data) return { status: "reconnect_required", reason: "missing_refresh_token" };

  const refreshToken = decrypt(data.refresh_token_enc, getTokenKey());
  if (!refreshToken) {
    console.error("[google/access-token] stored token did not decrypt", { userId });
    return { status: "reconnect_required", reason: "undecryptable_refresh_token" };
  }

  const result = await refreshAccessToken(refreshToken, userId);
  if (result.status !== "ok") return result;

  cache.set(userId, { accessToken: result.accessToken, expiresAt: result.expiresAt });
  return { status: "ok", accessToken: result.accessToken };
}
