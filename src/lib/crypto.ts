import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifragem simétrica AES-256-GCM para segredos de terceiros guardados no banco
 * (ex.: tokens OAuth de vendedores no Mercado Pago).
 * ENCRYPTION_KEY: 32 bytes em base64 (gere com `openssl rand -base64 32`).
 */
function getKey(rawKey = process.env.ENCRYPTION_KEY): Buffer {
  if (!rawKey) throw new Error("ENCRYPTION_KEY não configurada");
  const key = Buffer.from(rawKey, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY deve ter 32 bytes em base64");
  return key;
}

export function encryptSecret(plain: string, rawKey?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(rawKey), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(".");
}

export function decryptSecret(payload: string, rawKey?: string): string {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Formato de segredo inválido");
  const decipher = createDecipheriv("aes-256-gcm", getKey(rawKey), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
