import { sanitizeOAuthErrorBody } from "./log-sanitize";

export type RefreshResult =
  | { status: "ok"; accessToken: string; expiresAt: number; scopes: string[] }
  | { status: "reconnect_required"; reason: string }
  | { status: "error"; reason: string };

type GoogleTokenErrorBody = {
  error?: string;
  error_description?: string;
};

// Google's documented error codes for a dead/revoked/expired grant — the
// only case where re-authorization (not a retry) is the fix.
// https://developers.google.com/identity/protocols/oauth2/web-server#offline
const RECONNECT_REQUIRED_ERRORS = new Set(["invalid_grant", "unauthorized_client"]);

export function classifyRefreshFailure(
  httpStatus: number,
  body: GoogleTokenErrorBody
): { status: "reconnect_required" | "error"; reason: string } {
  const errorCode = body.error ?? "unknown_error";

  if (httpStatus === 400 && RECONNECT_REQUIRED_ERRORS.has(errorCode)) {
    return { status: "reconnect_required", reason: errorCode };
  }

  return { status: "error", reason: errorCode };
}

function isValidRefreshBody(
  body: unknown
): body is { access_token: string; expires_in: number; scope?: string } {
  if (body === null || typeof body !== "object") return false;
  const { access_token, expires_in, scope } = body as Record<string, unknown>;
  return (
    typeof access_token === "string" &&
    access_token.length > 0 &&
    typeof expires_in === "number" &&
    Number.isFinite(expires_in) &&
    (scope === undefined || typeof scope === "string")
  );
}

// One in-flight refresh per teacher, so parallel requests at expiry share it.
const inFlightRefreshes = new Map<string, Promise<RefreshResult>>();

// Exchanges a refresh token for an access token, and reports the scopes the
// teacher actually granted. Writes nothing. userId is only for logs.
export function refreshAccessToken(refreshToken: string, userId: string): Promise<RefreshResult> {
  const pending = inFlightRefreshes.get(userId);
  if (pending) return pending;

  const refresh = requestRefresh(refreshToken, userId).finally(() => {
    inFlightRefreshes.delete(userId);
  });
  inFlightRefreshes.set(userId, refresh);
  return refresh;
}

async function requestRefresh(refreshToken: string, userId: string): Promise<RefreshResult> {
  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
  } catch (err) {
    console.error("[google/token] refresh request threw", {
      userId,
      error: err instanceof Error ? err.message : "unknown",
    });
    return { status: "error", reason: "network_error" };
  }

  if (!response.ok) {
    // Text first, never .json() directly: a non-JSON body must not throw
    // here. The raw text is never logged, only the allowlisted fields.
    const rawText = await response.text().catch(() => "");
    let parsedBody: unknown = {};
    try {
      parsedBody = rawText ? JSON.parse(rawText) : {};
    } catch {
      parsedBody = {};
    }

    const sanitizedBody = sanitizeOAuthErrorBody(parsedBody);
    const classified = classifyRefreshFailure(response.status, sanitizedBody);

    console.error("[google/token] refresh failed", {
      userId,
      httpStatus: response.status,
      googleError: sanitizedBody,
      classification: classified.status,
    });

    return classified;
  }

  const data: unknown = await response.json().catch(() => null);
  if (!isValidRefreshBody(data)) {
    console.error("[google/token] refresh returned an invalid success body", { userId });
    return { status: "error", reason: "invalid_success_response" };
  }

  return {
    status: "ok",
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scopes: data.scope ? data.scope.split(" ") : [],
  };
}
