import { describe, expect, it } from "vitest";
import { initials } from "../initials";

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
