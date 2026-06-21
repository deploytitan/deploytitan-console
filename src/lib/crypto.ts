import crypto from "node:crypto";

const ENCRYPTION_CONTEXT = "deploytitan-integrations-v1";

function getEncryptionSecret() {
  const secret = process.env.DEPLOYTITAN_INTEGRATION_SECRET ?? "";
  if (!secret) {
    throw new Error("DEPLOYTITAN_INTEGRATION_SECRET is not configured.");
  }
  return crypto
    .createHash("sha256")
    .update(`${ENCRYPTION_CONTEXT}:${secret}`)
    .digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionSecret();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
}

export function decryptSecret(ciphertext: string) {
  const payload = Buffer.from(ciphertext, "base64url");
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const key = getEncryptionSecret();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}
