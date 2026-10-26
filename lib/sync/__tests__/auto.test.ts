import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/google/access-token", () => ({
  getAccessToken: vi.fn(async () => ({ status: "ok", accessToken: "token" })),
}));
vi.mock("@/lib/publish/run", () => ({ publishLibrary: vi.fn(async () => {}) }));
vi.mock("../run", () => ({ runSync: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));

import { publishLibrary } from "@/lib/publish/run";
import { syncNow } from "../auto";
import { runSync } from "../run";

describe("syncNow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads only while onboarding (publish: false)", async () => {
    await syncNow("u1", "example.edu", "onboarding", { publish: false });
    expect(runSync).toHaveBeenCalledWith("u1", "example.edu", "token", "onboarding");
    expect(publishLibrary).not.toHaveBeenCalled();
  });

  it("reads and publishes by default", async () => {
    await syncNow("u1", "example.edu", "onboarding");
    expect(runSync).toHaveBeenCalledWith("u1", "example.edu", "token", "onboarding");
    expect(publishLibrary).toHaveBeenCalledWith("u1", "example.edu", "token");
  });
});
