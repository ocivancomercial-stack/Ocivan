/**
 * Compressão no navegador antes do envio: reduz fotos de 4–12 MB do celular para ~300 KB,
 * economizando dados móveis e acelerando a publicação. O servidor revalida e reprocessa tudo.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob) return blob;
  } catch {
    // Formato que o navegador não decodifica (ex.: HEIC no Chrome): envia o original e o servidor decide.
  }
  return file;
}
