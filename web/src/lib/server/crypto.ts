import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey() {
  const value = process.env.XERO_TOKEN_ENCRYPTION_KEY;
  if (!value) {
    throw new Error("XERO_TOKEN_ENCRYPTION_KEY is required to store Xero tokens.");
  }

  const trimmed = value.trim();
  const hex = /^[0-9a-f]{64}$/i.test(trimmed) ? Buffer.from(trimmed, "hex") : null;
  if (hex?.length === KEY_LENGTH) return hex;

  const base64 = Buffer.from(trimmed, "base64");
  if (base64.length === KEY_LENGTH && base64.toString("base64").replace(/=+$/, "") === trimmed.replace(/=+$/, "")) {
    return base64;
  }

  return createHash("sha256").update(trimmed).digest();
}

export function encryptJson(value: unknown) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv, { authTagLength: TAG_LENGTH });
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptJson<T>(encrypted: string): T {
  const [ivValue, tagValue, ciphertextValue] = encrypted.split(".");
  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Encrypted payload is malformed.");
  }

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivValue, "base64url"), {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]);

  return JSON.parse(plaintext.toString("utf8")) as T;
}
