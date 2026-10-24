import { describe, expect, it } from "vitest";
import { emailDomain } from "@/lib/domain";

describe("emailDomain", () => {
  it("returns the lowercased domain", () => {
    expect(emailDomain("Teacher@Quillmont.Edu")).toBe("quillmont.edu");
  });

  it("rejects strings without a domain", () => {
    expect(() => emailDomain("nobody")).toThrow();
    expect(() => emailDomain("a@")).toThrow();
  });
});
