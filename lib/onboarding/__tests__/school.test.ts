import { describe, expect, it } from "vitest";
import { findSchool, parseSchoolName } from "../school";

describe("parseSchoolName", () => {
  it("trims and collapses spaces", () => {
    expect(parseSchoolName("  Central   Middle School ")).toBe("Central Middle School");
  });

  it("rejects too short or too long", () => {
    expect(parseSchoolName("A")).toBeNull();
    expect(parseSchoolName("   ")).toBeNull();
    expect(parseSchoolName(null)).toBeNull();
    expect(parseSchoolName("x".repeat(121))).toBeNull();
  });
});

describe("findSchool", () => {
  const schools = [
    { id: "1", name: "Central Middle School" },
    { id: "2", name: "Westview Middle School" },
  ];

  it("finds a school ignoring case and spaces", () => {
    expect(findSchool(schools, "central  middle school")?.id).toBe("1");
  });

  it("returns null for a new name", () => {
    expect(findSchool(schools, "Central MS")).toBeNull();
  });
});
