import { describe, expect, it } from "vitest";
import { draftLink } from "../links";

describe("draftLink", () => {
  it("encodes both ids as unpadded base64", () => {
    expect(draftLink("123456789", "98765")).toBe(
      "https://classroom.google.com/c/MTIzNDU2Nzg5/a/OTg3NjU/details"
    );
  });
});
