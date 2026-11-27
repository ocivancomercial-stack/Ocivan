import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertSafeKey, localUploadsRoot } from "@/services/storage";

/** Serve arquivos do storage LOCAL (apenas desenvolvimento/homologação). Em produção, imagens vêm do Supabase. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (process.env.STORAGE_DRIVER === "supabase" || process.env.APP_ENV === "production") return new Response(null, { status: 404 });
  const key = (await params).key.join("/");
  try {
    assertSafeKey(key);
    const data = await readFile(path.join(localUploadsRoot(), key));
    const type = key.endsWith(".webp") ? "image/webp" : key.endsWith(".png") ? "image/png" : "image/jpeg";
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
