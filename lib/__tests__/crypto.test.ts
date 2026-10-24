import { randomBytes } from "crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, parseKey } from "../crypto";

const key = randomBytes(32);

describe("encrypt / decrypt", () => {
  it("round-trips a token", () => {
    const sealed = encrypt("1//refresh-token", key);
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("refresh-token");
    expect(decrypt(sealed, key)).toBe("1//refresh-token");
  });

  it("uses a fresh IV each time", () => {
    expect(encrypt("same", key)).not.toBe(encrypt("same", key));
  });

  it("returns null for the wrong key", () => {
    expect(decrypt(encrypt("secret", key), randomBytes(32))).toBeNull();
  });

  it("returns null for edited ciphertext", () => {
    const sealed = encrypt("secret", key);
    const flipped = sealed.slice(0, -2) + (sealed.endsWith("A") ? "B" : "A") + sealed.slice(-1);
    expect(decrypt(flipped, key)).toBeNull();
  });

  it("returns null for garbage and other versions", () => {
    expect(decrypt("", key)).toBeNull();
    expect(decrypt("not a token", key)).toBeNull();
    expect(decrypt("v2.AAAA", key)).toBeNull();
    expect(decrypt("v1.AAAA", key)).toBeNull();
  });
});

describe("parseKey", () => {
  it("accepts 32 base64 bytes", () => {
    expect(parseKey(randomBytes(32).toString("base64"), "K")).toHaveLength(32);
  });

  it("rejects a missing or short key, naming it", () => {
    expect(() => parseKey(undefined, "K")).toThrow("K is not set");
    expect(() => parseKey(randomBytes(16).toString("base64"), "K")).toThrow("K must be 32 bytes");
  });
});
