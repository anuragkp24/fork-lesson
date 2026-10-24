import { describe, expect, it } from "vitest";
import { sanitizeOAuthErrorBody } from "../google/log-sanitize";
import { missingScopes, REQUIRED_SCOPES, SIGN_IN_SCOPES } from "../google/scopes";
import { classifyRefreshFailure } from "../google/token";

describe("missingScopes", () => {
  it("is empty when everything was granted, identity scopes or not", () => {
    expect(missingScopes(["openid", "email", ...REQUIRED_SCOPES])).toEqual([]);
  });

  it("lists the scopes a teacher unticked", () => {
    const granted = REQUIRED_SCOPES.filter((s) => !s.endsWith("drive.readonly"));
    expect(missingScopes([...granted])).toEqual(["https://www.googleapis.com/auth/drive.readonly"]);
  });

  it("asks for identity scopes plus every required one at sign-in", () => {
    const asked = SIGN_IN_SCOPES.split(" ");
    expect(asked.slice(0, 3)).toEqual(["openid", "email", "profile"]);
    expect(asked).toHaveLength(3 + REQUIRED_SCOPES.length);
  });
});

describe("classifyRefreshFailure", () => {
  it("asks for reconnect on a dead grant", () => {
    expect(classifyRefreshFailure(400, { error: "invalid_grant" }).status).toBe("reconnect_required");
  });

  it("treats other failures as retryable errors", () => {
    expect(classifyRefreshFailure(500, { error: "invalid_grant" }).status).toBe("error");
    expect(classifyRefreshFailure(400, {}).reason).toBe("unknown_error");
  });
});

describe("sanitizeOAuthErrorBody", () => {
  it("keeps only the allowlisted fields", () => {
    expect(
      sanitizeOAuthErrorBody({ error: "invalid_grant", error_description: "Bad", refresh_token: "secret" })
    ).toEqual({ error: "invalid_grant", error_description: "Bad" });
  });

  it("handles non-objects", () => {
    expect(sanitizeOAuthErrorBody(null)).toEqual({});
    expect(sanitizeOAuthErrorBody("oops")).toEqual({});
  });
});
