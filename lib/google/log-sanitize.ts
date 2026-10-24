// Strict allowlist for what's safe to put in server logs from Google's OAuth
// token-endpoint error responses. Never log raw response bodies or headers —
// only these two known, non-sensitive fields. Never include token values.

export type SanitizedOAuthError = {
  error?: string;
  error_description?: string;
};

const OAUTH_ERROR_FIELDS = ["error", "error_description"] as const;

export function sanitizeOAuthErrorBody(parsed: unknown): SanitizedOAuthError {
  if (typeof parsed !== "object" || parsed === null) return {};

  const source = parsed as Record<string, unknown>;
  const sanitized: SanitizedOAuthError = {};

  for (const field of OAUTH_ERROR_FIELDS) {
    const value = source[field];
    if (typeof value === "string") {
      sanitized[field] = value;
    }
  }

  return sanitized;
}
