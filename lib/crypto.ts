import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM for the Google refresh token at rest. Keys are passed in, so
// tests can use fixed ones; getTokenKey() reads the real one from the
// environment.

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
// Binds the ciphertext to this purpose, so a value encrypted for something
// else with the same key can't be swapped in.
const AAD = Buffer.from("fl_refresh.v1");

// Keys are 32 random bytes, base64-encoded (`openssl rand -base64 32`).
export function parseKey(raw: string | undefined, name: string): Buffer {
  if (!raw) throw new Error(`${name} is not set`);
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error(`${name} must be 32 bytes, base64-encoded`);
  return key;
}

export function getTokenKey(): Buffer {
  return parseKey(process.env.TOKEN_ENCRYPTION_KEY, "TOKEN_ENCRYPTION_KEY");
}

// The output is "v1." + base64url(iv | ciphertext | tag).
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(AAD);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${VERSION}.${Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64url")}`;
}

// Null for anything that isn't ours: wrong key, edited bytes, wrong version
// or plain garbage. GCM's tag check is what catches tampering.
export function decrypt(value: string, key: Buffer): string | null {
  const [version, encoded, ...rest] = value.split(".");
  if (version !== VERSION || !encoded || rest.length > 0) return null;

  const raw = Buffer.from(encoded, "base64url");
  if (raw.length < IV_BYTES + TAG_BYTES) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, IV_BYTES));
    decipher.setAAD(AAD);
    decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
    const body = raw.subarray(IV_BYTES, raw.length - TAG_BYTES);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
