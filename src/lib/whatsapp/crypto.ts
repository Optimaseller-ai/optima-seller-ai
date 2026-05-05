import "server-only";

import crypto from "node:crypto";

function getKey() {
  const raw = (process.env.WHATSAPP_TOKEN_ENC_KEY ?? "").trim();
  if (!raw) throw new Error("Missing env WHATSAPP_TOKEN_ENC_KEY.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("WHATSAPP_TOKEN_ENC_KEY must be base64-encoded 32 bytes.");
  return key;
}

export type EncryptedSecret = {
  alg: "aes-256-gcm";
  iv: string; // base64
  tag: string; // base64
  data: string; // base64
};

export function encryptSecret(plaintext: string): EncryptedSecret {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { alg: "aes-256-gcm", iv: iv.toString("base64"), tag: tag.toString("base64"), data: data.toString("base64") };
}

export function decryptSecret(payload: EncryptedSecret): string {
  if (payload.alg !== "aes-256-gcm") throw new Error("Unsupported encryption algorithm.");
  const key = getKey();
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const data = Buffer.from(payload.data, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return out.toString("utf8");
}
