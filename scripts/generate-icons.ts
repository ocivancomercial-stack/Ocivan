/** Gera os ícones do PWA a partir do símbolo da marca. Uso: npx tsx scripts/generate-icons.ts */
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const mark = (bg: string, pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${40 + pad * 2} ${40 + pad * 2}">
  <rect x="${-pad}" y="${-pad}" width="${40 + pad * 2}" height="${40 + pad * 2}" fill="${bg}"/>
  <path d="M20 13.5v-1.2a2.6 2.6 0 1 0-2.6-2.6" fill="none" stroke="#E7B75B" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M20 14.2 9.6 23.4a2.4 2.4 0 0 0 1.6 4.2H19" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M20 14.2l10.4 9.2a2.4 2.4 0 0 1-1.6 4.2H24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16.6 25.2 19.2 27.6 16.6 30" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M26.4 25.2 23.8 27.6 26.4 30" fill="none" stroke="#CFE8DB" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

async function png(svg: string, size: number, file: string) {
  writeFileSync(file, await sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toBuffer());
}

(async () => {
  mkdirSync("public/icons", { recursive: true });
  await png(mark("#174C3C"), 192, "public/icons/icon-192.png");
  await png(mark("#174C3C"), 512, "public/icons/icon-512.png");
  await png(mark("#174C3C", 8), 512, "public/icons/maskable-512.png"); // área segura para ícones adaptativos
  await png(mark("#174C3C", 4), 180, "src/app/apple-icon.png");
  await png(mark("#174C3C"), 48, "public/icons/icon-48.png");
  writeFileSync("src/app/icon.svg", mark("#174C3C").replace("<rect", '<rect rx="10"'));
  console.log("✔ ícones gerados");
})();
