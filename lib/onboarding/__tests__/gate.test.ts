import { describe, expect, it } from "vitest";
import { safeNext, welcomePath, welcomeStep } from "../gate";

describe("welcomeStep", () => {
  it("asks for the school first", () => {
    expect(welcomeStep({ onboardedAt: null, schoolId: null })).toBe("school");
  });

  it("goes to classes once a school is set", () => {
    expect(welcomeStep({ onboardedAt: null, schoolId: "s1" })).toBe("classes");
  });

  it("is done once onboarded, school or not", () => {
    expect(welcomeStep({ onboardedAt: "2026-10-25T12:00:00Z", schoolId: "s1" })).toBe("done");
    expect(welcomeStep({ onboardedAt: "2026-10-25T12:00:00Z", schoolId: null })).toBe("done");
  });
});

describe("safeNext", () => {
  it("accepts paths inside the app", () => {
    expect(safeNext("/lesson/abc")).toBe("/lesson/abc");
    expect(safeNext("/library?q=ratios")).toBe("/library?q=ratios");
  });

  it("rejects other sites and odd input", () => {
    expect(safeNext("//evil.com")).toBeNull();
    expect(safeNext("https://evil.com")).toBeNull();
    expect(safeNext("/\\evil.com")).toBeNull();
    expect(safeNext("lesson/abc")).toBeNull();
    expect(safeNext("/lesson\nabc")).toBeNull();
    expect(safeNext("")).toBeNull();
    expect(safeNext(null)).toBeNull();
    expect(safeNext(`/${"a".repeat(600)}`)).toBeNull();
  });
});

describe("welcomePath", () => {
  it("keeps a safe next", () => {
    expect(welcomePath("classes", "/lesson/abc")).toBe("/welcome/classes?next=%2Flesson%2Fabc");
  });

  it("drops an unsafe or missing next", () => {
    expect(welcomePath("school", "//evil.com")).toBe("/welcome/school");
    expect(welcomePath("done")).toBe("/welcome/done");
  });
});
