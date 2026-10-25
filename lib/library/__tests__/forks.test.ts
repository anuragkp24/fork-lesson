import { describe, expect, it } from "vitest";
import { forkStatusLabel, forkedLabel, hubSection, hubTarget, myForkStatus, taughtLabel } from "../forks";

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

describe("taughtLabel", () => {
  it("pluralizes and hides zero or a hidden count", () => {
    expect(taughtLabel(1)).toBe("Taught in 1 class");
    expect(taughtLabel(3)).toBe("Taught in 3 classes");
    expect(taughtLabel(0)).toBeNull();
    expect(taughtLabel(null)).toBeNull();
    expect(taughtLabel(undefined)).toBeNull();
  });
});

describe("hubSection", () => {
  it("shows the author Forked by, even before anyone forks", () => {
    expect(hubSection({ isOwner: true, forkCount: 2 })).toBe("forked-by");
    expect(hubSection({ isOwner: true, forkCount: 0 })).toBe("forked-by");
  });

  it("shows a forker their own forks, including two of the same lesson", () => {
    expect(hubSection({ isOwner: false, forkCount: 1 })).toBe("your-fork");
    expect(hubSection({ isOwner: false, forkCount: 2 })).toBe("your-fork");
  });

  it("shows a bystander nothing", () => {
    expect(hubSection({ isOwner: false, forkCount: 0 })).toBeNull();
  });
});
