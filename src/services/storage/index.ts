import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { logger } from "@/lib/logger";

/** Armazenamento de arquivos públicos (fotos de produtos e avatares). */
export interface StorageProvider {
  readonly name: string;
  /** Grava o arquivo e devolve a URL pública. `key` é relativo (ex.: products/abc/1.webp). */
  put(key: string, data: Buffer, contentType: string): Promise<{ key: string; url: string }>;
  remove(keys: string[]): Promise<void>;
}

export function localUploadsRoot() {
  return path.join(process.cwd(), ".data", "uploads");
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_-]*\.(webp|jpg|png)$/;
export function assertSafeKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..") || key.includes("//")) throw new Error(`Chave de storage inválida: ${key}`);
}

/**
 * DESENVOLVIMENTO: grava em .data/uploads e é servido pela rota src/app/uploads/[...key]/route.ts.
 * Não funciona na Vercel (sistema de arquivos efêmero) — bloqueado em produção por src/lib/env.ts.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  constructor(readonly root = localUploadsRoot()) {}

  async put(key: string, data: Buffer) {
    assertSafeKey(key);
    const file = path.join(this.root, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
    return { key, url: `/uploads/${key}` };
  }

  async remove(keys: string[]) {
    for (const key of keys) {
      assertSafeKey(key);
      await rm(path.join(this.root, key), { force: true });
    }
  }
}

/**
 * Supabase Storage via API REST (https://supabase.com/docs/reference/api — Storage).
 * O bucket deve ser PÚBLICO para leitura; a gravação usa a service role key, apenas no servidor.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = "supabase";
  constructor(private url: string, private serviceKey: string, private bucket: string) {}

  private headers(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey, ...extra };
  }

  async put(key: string, data: Buffer, contentType: string) {
    assertSafeKey(key);
    const res = await fetch(`${this.url}/storage/v1/object/${this.bucket}/${key}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": contentType, "x-upsert": "true", "cache-control": "max-age=31536000" }),
      body: new Uint8Array(data),
    });
    if (!res.ok) {
      logger.error("storage.put_failed", { status: res.status, key });
      throw new Error(`Falha ao enviar imagem (HTTP ${res.status})`);
    }
    return { key, url: `${this.url}/storage/v1/object/public/${this.bucket}/${key}` };
  }

  async remove(keys: string[]) {
    if (keys.length === 0) return;
    keys.forEach(assertSafeKey);
    const res = await fetch(`${this.url}/storage/v1/object/${this.bucket}`, {
      method: "DELETE",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: keys }),
    });
    if (!res.ok) logger.warn("storage.remove_failed", { status: res.status, count: keys.length });
  }
}

let provider: StorageProvider | undefined;
export function getStorage(): StorageProvider {
  if (provider) return provider;
  if (process.env.STORAGE_DRIVER === "supabase") {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase Storage não configurado");
    provider = new SupabaseStorageProvider(SUPABASE_URL.replace(/\/$/, ""), SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET ?? "product-images");
  } else {
    if (process.env.APP_ENV === "production") throw new Error("Storage local é proibido em produção");
    provider = new LocalStorageProvider();
  }
  return provider;
}

export function setStorage(p: StorageProvider) {
  provider = p;
}

/** Storage em memória para testes. */
export class MemoryStorageProvider implements StorageProvider {
  readonly name = "memory";
  readonly files = new Map<string, Buffer>();
  async put(key: string, data: Buffer) {
    assertSafeKey(key);
    this.files.set(key, data);
    return { key, url: `/mem/${key}` };
  }
  async remove(keys: string[]) {
    keys.forEach((k) => this.files.delete(k));
  }
}
