import { describe, expect, it } from "vitest";
import { VISIT_MAX_AGE_MINUTES, needsSignIn, needsSync, pickTeachersForNightly, syncedAgo, SIGN_IN_NEEDED, SIGN_IN_REJECTED } from "../schedule";

const now = new Date("2026-10-25T12:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

describe("needsSync", () => {
  it("runs when never synced", () => {
    expect(needsSync({ lastStartedAt: null, lastFinishedAt: null, now })).toBe("run");
  });

  it("is fresh inside the 2-minute visit window", () => {
    expect(needsSync({ lastStartedAt: ago(2), lastFinishedAt: ago(1), now })).toBe("fresh");
    expect(needsSync({ lastStartedAt: ago(1), lastFinishedAt: ago(0.5), now })).toBe("fresh");
  });

  it("runs once the visit window has passed", () => {
    expect(needsSync({ lastStartedAt: ago(4), lastFinishedAt: ago(2), now })).toBe("run");
    expect(needsSync({ lastStartedAt: ago(41), lastFinishedAt: ago(40), now })).toBe("run");
  });

  it("uses a 2-minute window by default", () => {
    expect(VISIT_MAX_AGE_MINUTES).toBe(2);
  });

  it("is running when started recently and not finished", () => {
    expect(needsSync({ lastStartedAt: ago(2), lastFinishedAt: ago(300), now })).toBe("running");
    expect(needsSync({ lastStartedAt: ago(2), lastFinishedAt: null, now })).toBe("running");
  });

  it("treats a sync that never finished as stuck after 5 minutes", () => {
    expect(needsSync({ lastStartedAt: ago(6), lastFinishedAt: ago(300), now })).toBe("run");
    expect(needsSync({ lastStartedAt: ago(6), lastFinishedAt: null, now })).toBe("run");
  });

  it("is not running when the last start has finished", () => {
    expect(needsSync({ lastStartedAt: ago(2), lastFinishedAt: ago(1), now })).toBe("fresh");
  });

  it("uses the given window", () => {
    const times = { lastStartedAt: ago(61), lastFinishedAt: ago(60), now };
    expect(needsSync({ ...times, maxAgeMinutes: 120 })).toBe("fresh");
    expect(needsSync({ ...times, maxAgeMinutes: 30 })).toBe("run");
    expect(needsSync({ ...times, maxAgeMinutes: 61 })).toBe("fresh");
  });
});

describe("needsSignIn", () => {
  it("recognises the two sign-in messages only", () => {
    expect(needsSignIn(SIGN_IN_NEEDED)).toBe(true);
    expect(needsSignIn(SIGN_IN_REJECTED)).toBe(true);
    expect(needsSignIn("Google said 500.")).toBe(false);
    expect(needsSignIn(null)).toBe(false);
  });
});

describe("pickTeachersForNightly", () => {
  const row = (userId: string, finishedMinutesAgo: number | null, extra = {}) => ({
    userId,
    lastStartedAt: finishedMinutesAgo === null ? null : ago(finishedMinutesAgo + 1),
    lastFinishedAt: finishedMinutesAgo === null ? null : ago(finishedMinutesAgo),
    lastError: null,
    ...extra,
  });
  const day = 24 * 60;

  it("takes the stalest first, never-synced before all", () => {
    const rows = [row("a", day + 10), row("b", day * 3), row("c", null), row("d", day * 2)];
    expect(pickTeachersForNightly(rows, now, 10).map((r) => r.userId)).toEqual(["c", "b", "d", "a"]);
  });

  it("stops at the limit", () => {
    const rows = [row("a", day * 2), row("b", day * 3), row("c", day * 4)];
    expect(pickTeachersForNightly(rows, now, 2).map((r) => r.userId)).toEqual(["c", "b"]);
    expect(pickTeachersForNightly(rows, now, 0)).toEqual([]);
  });

  it("skips teachers synced in the last 24 hours", () => {
    expect(pickTeachersForNightly([row("a", day - 5), row("b", 10)], now, 5)).toEqual([]);
  });

  it("skips teachers who need to sign in again", () => {
    const rows = [
      row("a", day * 5, { lastError: SIGN_IN_NEEDED }),
      row("b", day * 5, { lastError: SIGN_IN_REJECTED }),
      row("c", day * 5, { lastError: "Google said 500." }),
    ];
    expect(pickTeachersForNightly(rows, now, 5).map((r) => r.userId)).toEqual(["c"]);
  });

  it("skips a teacher whose sync is running right now", () => {
    const running = { userId: "a", lastStartedAt: ago(1), lastFinishedAt: ago(day * 2), lastError: null };
    expect(pickTeachersForNightly([running], now, 5)).toEqual([]);
  });
});

describe("syncedAgo", () => {
  it("reads naturally", () => {
    expect(syncedAgo(ago(0), now)).toBe("just now");
    expect(syncedAgo(ago(1), now)).toBe("1 minute ago");
    expect(syncedAgo(ago(12), now)).toBe("12 minutes ago");
    expect(syncedAgo(ago(60), now)).toBe("1 hour ago");
    expect(syncedAgo(ago(5 * 60), now)).toBe("5 hours ago");
    expect(syncedAgo(ago(3 * 24 * 60), now)).toBe("3 days ago");
  });
});
