import { describe, expect, it } from "vitest";
import { forkStatusLabel, forkedLabel, hubTarget, myForkStatus } from "../forks";

describe("forkedLabel", () => {
  it("pluralizes and hides zero", () => {
    expect(forkedLabel(0)).toBeNull();
    expect(forkedLabel(1)).toBe("Forked 1 time");
    expect(forkedLabel(3)).toBe("Forked 3 times");
  });
});

describe("hubTarget", () => {
  it("sends a fork to its original", () => {
    expect(hubTarget({ kind: "fork", forked_from_lesson_id: "orig" })).toBe("orig");
  });

  it("leaves originals alone, and forks whose original is gone", () => {
    expect(hubTarget({ kind: "original", forked_from_lesson_id: null })).toBeNull();
    expect(hubTarget({ kind: "fork", forked_from_lesson_id: null })).toBeNull();
  });
});

describe("forkStatusLabel", () => {
  it("names the states and shows nothing for a draft someone else can't see", () => {
    expect(forkStatusLabel("ASSIGNED")).toBe("Assigned");
    expect(forkStatusLabel("DRAFT")).toBe("Draft");
    expect(forkStatusLabel(null)).toBeNull();
  });
});

describe("myForkStatus", () => {
  it("reads Classroom's state", () => {
    expect(myForkStatus("PUBLISHED")).toBe("Assigned");
    expect(myForkStatus("DRAFT")).toBe("Draft");
    expect(myForkStatus(null)).toBeNull();
  });
});
