import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { ImageValidationError, processUploadedImage } from "@/services/images/process";
import { assertSafeKey } from "@/services/storage";
import { photo } from "../setup/fixtures";

describe("processamento de imagens", () => {
  it("reencoda em WebP e limita a 1600px", async () => {
    const out = await processUploadedImage(await photo(3000, 2000));
    expect(out.contentType).toBe("image/webp");
    expect(Math.max(out.width, out.height)).toBe(1600);
    expect((await sharp(out.data).metadata()).format).toBe("webp");
  });

  it("remove metadados EXIF (privacidade/GPS)", async () => {
    const input = await photo(800, 800, true);
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const out = await processUploadedImage(input);
    expect((await sharp(out.data).metadata()).exif).toBeUndefined();
  });

  it("recusa arquivo que não é imagem, mesmo com nome .jpg", async () => {
    await expect(processUploadedImage(Buffer.from("<script>alert(1)</script>"))).rejects.toThrow(ImageValidationError);
  });

  it("recusa imagem muito pequena", async () => {
    await expect(processUploadedImage(await photo(100, 100))).rejects.toThrow(/300×300/);
  });

  it("recusa SVG (pode conter scripts)", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800"/></svg>');
    await expect(processUploadedImage(svg)).rejects.toThrow(/Formato não aceito/);
  });

  it("recusa arquivo acima de 8 MB", async () => {
    await expect(processUploadedImage(Buffer.alloc(8 * 1024 * 1024 + 1))).rejects.toThrow(/8 MB/);
  });

  it("avatar quadrado", async () => {
    const out = await processUploadedImage(await photo(1200, 800), { maxSide: 400, square: true });
    expect([out.width, out.height]).toEqual([400, 400]);
  });
});

describe("chaves de storage", () => {
  it.each(["../etc/passwd.webp", "products//x.webp", "/abs.webp", "products/x.php", "products/../x.webp"])("bloqueia %s", (k) => {
    expect(() => assertSafeKey(k)).toThrow();
  });
  it("aceita chave válida", () => expect(() => assertSafeKey("products/4f1c-ab.webp")).not.toThrow());
});
