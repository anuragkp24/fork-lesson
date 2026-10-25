import { describe, expect, it } from "vitest";
import { firstName, initials } from "../initials";

describe("initials", () => {
  it("uses first and last name", () => {
    expect(initials("Sofia Marchetti", null)).toBe("SM");
    expect(initials("Samuel van Adeyemi", null)).toBe("SA");
  });

  it("falls back to one name, then the email", () => {
    expect(initials("Sofia", null)).toBe("SO");
    expect(initials(null, "samuel@x.org")).toBe("SA");
    expect(initials("", null)).toBe("?");
  });
});

describe("firstName", () => {
  it("takes the first word, or null without a name", () => {
    expect(firstName("Sofia Marchetti")).toBe("Sofia");
    expect(firstName("  Henry  ")).toBe("Henry");
    expect(firstName("")).toBeNull();
    expect(firstName(null)).toBeNull();
  });
});
