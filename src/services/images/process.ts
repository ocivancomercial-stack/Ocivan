import sharp, { type Metadata } from "sharp";

export const IMAGE_RULES = {
  maxBytes: 8 * 1024 * 1024, // 8 MB por arquivo enviado
  maxPerProduct: 8,
  acceptedFormats: ["jpeg", "png", "webp", "heif", "avif"] as const,
  minSide: 300,
  maxSide: 1600,
};

export class ImageValidationError extends Error {}

/**
 * Valida e normaliza uma imagem enviada:
 *  - verifica o formato REAL pelo conteúdo (não confia em extensão nem Content-Type);
 *  - aplica a rotação EXIF, redimensiona e reencoda em WebP;
 *  - remove todos os metadados (EXIF/GPS) — protege a localização de quem anuncia.
 */
export async function processUploadedImage(input: Buffer, { maxSide = IMAGE_RULES.maxSide, square = false } = {}) {
  if (input.byteLength === 0) throw new ImageValidationError("Arquivo vazio");
  if (input.byteLength > IMAGE_RULES.maxBytes) throw new ImageValidationError("Cada foto pode ter no máximo 8 MB");

  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    throw new ImageValidationError("Arquivo não é uma imagem válida");
  }
  if (!meta.format || !(IMAGE_RULES.acceptedFormats as readonly string[]).includes(meta.format))
    throw new ImageValidationError("Formato não aceito. Use JPG, PNG, WEBP ou HEIC/AVIF");
  if ((meta.width ?? 0) < IMAGE_RULES.minSide || (meta.height ?? 0) < IMAGE_RULES.minSide)
    throw new ImageValidationError(`A foto precisa ter pelo menos ${IMAGE_RULES.minSide}×${IMAGE_RULES.minSide} pixels`);

  const pipeline = sharp(input, { limitInputPixels: 50_000_000 }).rotate();
  const resized = square
    ? pipeline.resize(maxSide, maxSide, { fit: "cover" })
    : pipeline.resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true });
  const { data, info } = await resized.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, contentType: "image/webp" as const };
}
