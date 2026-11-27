/**
 * Dados de DEMONSTRAÇÃO — 100% fictícios.
 *  - Vendedores com e-mail @exemplo.repassaai.dev e SEM senha (não conseguem fazer login).
 *  - Produtos com isSample=true: exibidos com selo "Exemplo", aviso na página e fora do índice de buscadores.
 *  - Imagens ilustrativas geradas localmente (não são fotos de produtos reais).
 * Nunca executado com APP_ENV=production (ver prisma/seed/index.ts).
 */
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { PrismaClient, ProductCondition } from "@prisma/client";
import { findCity } from "../../src/lib/regions";
import { getStorage } from "../../src/services/storage";

const SELLERS = [
  { name: "Ana Exemplo", email: "ana@exemplo.repassaai.dev", city: "Curitiba" },
  { name: "Bruno Exemplo", email: "bruno@exemplo.repassaai.dev", city: "São José dos Pinhais" },
  { name: "Carla Exemplo", email: "carla@exemplo.repassaai.dev", city: "Colombo" },
  { name: "Brechó Exemplo", email: "brecho@exemplo.repassaai.dev", city: "Pinhais" },
];

type Sample = { title: string; sub: string; brand?: string; size: string; color: string; condition: ProductCondition; price: number; seller: number; featured?: boolean; defects?: string };

const SAMPLES: Sample[] = [
  { title: "Jaqueta jeans clássica azul", sub: "roupas-jaquetas-e-casacos", brand: "levi-s", size: "M", color: "Azul", condition: "EXCELLENT", price: 149.9, seller: 0, featured: true },
  { title: "Vestido midi floral", sub: "roupas-vestidos", brand: "farm", size: "P", color: "Estampado", condition: "GOOD", price: 89, seller: 2 },
  { title: "Moletom canguru cinza", sub: "roupas-moletons", brand: "hering", size: "G", color: "Cinza", condition: "GOOD", price: 59.9, seller: 1 },
  { title: "Camiseta básica branca algodão", sub: "roupas-camisetas", brand: "reserva", size: "M", color: "Branco", condition: "NEW_WITH_TAGS", price: 45, seller: 3 },
  { title: "Calça jeans skinny escura", sub: "roupas-jeans", brand: "zara", size: "38", color: "Azul-marinho", condition: "EXCELLENT", price: 69.9, seller: 0 },
  { title: "Casaco de lã para o inverno", sub: "roupas-jaquetas-e-casacos", size: "GG", color: "Bege", condition: "GOOD", price: 120, seller: 3, featured: true, defects: "Pequeno fio puxado na manga esquerda." },
  { title: "Blusa de tricô vinho", sub: "roupas-malhas-e-tricos", brand: "renner", size: "M", color: "Vermelho", condition: "EXCELLENT", price: 54.9, seller: 2 },
  { title: "Tênis de corrida leve", sub: "tenis-corrida", brand: "asics", size: "40", color: "Preto", condition: "GOOD", price: 199, seller: 1, featured: true },
  { title: "Tênis casual de lona branco", sub: "tenis-casual", brand: "converse", size: "37", color: "Branco", condition: "EXCELLENT", price: 129.9, seller: 0 },
  { title: "Tênis skate camurça", sub: "tenis-skate", brand: "vans", size: "42", color: "Preto", condition: "FAIR", price: 89.9, seller: 1, defects: "Desgaste visível na sola e no bico." },
  { title: "Tênis cano alto retrô", sub: "tenis-cano-alto", brand: "nike", size: "41", color: "Colorido", condition: "EXCELLENT", price: 279, seller: 3, featured: true },
  { title: "Tênis de treino para academia", sub: "tenis-treino-e-academia", brand: "olympikus", size: "39", color: "Cinza", condition: "GOOD", price: 99, seller: 2 },
  { title: "Bota de couro cano curto", sub: "sapatos-botas", brand: "dakota", size: "36", color: "Marrom", condition: "EXCELLENT", price: 159, seller: 2 },
  { title: "Sandália de salto bloco", sub: "sapatos-salto-alto", brand: "arezzo", size: "35", color: "Bege", condition: "GOOD", price: 119.9, seller: 0 },
  { title: "Mocassim social masculino", sub: "sapatos-mocassins-e-loafers", size: "42", color: "Preto", condition: "GOOD", price: 99.9, seller: 1 },
  { title: "Sapatilha de bico fino", sub: "sapatos-sapatilhas", brand: "vizzano", size: "37", color: "Rosa", condition: "NEW_WITHOUT_TAGS", price: 49.9, seller: 3 },
  { title: "Bolsa transversal de couro", sub: "bolsas-transversais", brand: "anacapri", size: "Única", color: "Marrom", condition: "EXCELLENT", price: 139, seller: 2, featured: true },
  { title: "Mochila urbana para notebook", sub: "bolsas-mochilas", size: "Média", color: "Preto", condition: "GOOD", price: 79.9, seller: 1 },
  { title: "Bolsa tote de lona", sub: "bolsas-tote-e-shopper", size: "Grande", color: "Bege", condition: "EXCELLENT", price: 59, seller: 0 },
  { title: "Clutch dourada para festa", sub: "bolsas-clutches", size: "Pequena", color: "Dourado", condition: "NEW_WITH_TAGS", price: 69.9, seller: 3 },
];

const COLOR_HEX: Record<string, string> = {
  Azul: "#5b8fc9", Estampado: "#d98c8c", Cinza: "#9aa3a0", Branco: "#e9ece9", "Azul-marinho": "#2f4466", Bege: "#d8c4a4", Vermelho: "#9c3b3b",
  Preto: "#2b2f2d", Colorido: "#e7b75b", Marrom: "#8a5a3c", Rosa: "#e3a5b8", Dourado: "#d4b057",
};

const ICON: Record<string, string> = {
  roupas: "M9 3.5a3 3 0 0 0 6 0l5 2.2 1.5 5-3 1.2V20.5H5.5v-8.6l-3-1.2L4 5.7z",
  tenis: "M2.5 16.5V9l4 1.5L9 7.5l3 3.5c2 2 5 2.5 7.5 3a2.5 2.5 0 0 1 2 2.5v.5H2.5z",
  sapatos: "M3 18.5V8.5c3 0 4.5 1 6 3.5l3 3c1.5 1.3 4 1.3 6 1.6a2.6 2.6 0 0 1 2.5 1.9H3z",
  bolsas: "M4.5 9h15l-1.2 11.5H5.7zM8.5 9V7a3.5 3.5 0 0 1 7 0v2",
};

async function illustration(root: string, color: string, variant: number) {
  const fill = COLOR_HEX[color] ?? "#24845E";
  const bg = ["#E5F3EB", "#F3EEE4", "#EEF0F4"][variant % 3];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
    <rect width="800" height="1000" fill="${bg}"/>
    <circle cx="400" cy="470" r="${300 - variant * 20}" fill="#ffffff" opacity="0.7"/>
    <g transform="translate(160 230) scale(20)"><path d="${ICON[root]}" fill="${fill}" stroke="#174C3C" stroke-width="0.6" stroke-linejoin="round"/></g>
    <rect x="250" y="860" width="300" height="70" rx="35" fill="#E7B75B"/>
    <text x="400" y="907" font-family="sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="#174C3C">EXEMPLO</text>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}

export async function seedSamples(prisma: PrismaClient) {
  const existing = await prisma.product.count({ where: { isSample: true } });
  if (existing > 0) {
    console.log(`ℹ Anúncios de exemplo já existem (${existing}). Nada a fazer.`);
    return;
  }
  const sellers = [];
  for (const s of SELLERS) {
    sellers.push(
      await prisma.user.upsert({
        where: { email: s.email },
        update: {},
        create: { ...s, state: "PR", emailVerified: false, termsAcceptedAt: new Date() },
      }),
    );
  }
  const storage = getStorage();
  for (const [i, s] of SAMPLES.entries()) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: s.sub }, include: { parent: true } });
    const brand = s.brand ? await prisma.brand.findUnique({ where: { slug: s.brand } }) : null;
    const seller = SELLERS[s.seller];
    const city = findCity(seller.city)!;
    const images = [];
    for (let v = 0; v < 2; v++) {
      const { key, url } = await storage.put(`products/${randomUUID()}.webp`, await illustration(category.parent!.slug, s.color, v), "image/webp");
      images.push({ storageKey: key, imageUrl: url, position: v, width: 800, height: 1000 });
    }
    const publishedAt = new Date(Date.now() - i * 3 * 3600_000);
    await prisma.product.create({
      data: {
        sellerId: sellers[s.seller].id,
        categoryId: category.id,
        brandId: brand?.id,
        title: s.title,
        description: `ANÚNCIO FICTÍCIO DE DEMONSTRAÇÃO — não está à venda.\n\n${s.title} em ${s.color.toLowerCase()}, tamanho ${s.size}. Texto de exemplo para visualizar o layout da página do produto.`,
        defects: s.defects,
        size: s.size,
        color: s.color,
        condition: s.condition,
        priceCents: Math.round(s.price * 100),
        status: "ACTIVE",
        city: seller.city,
        latitude: city.lat,
        longitude: city.lng,
        isFeatured: s.featured ?? false,
        isSample: true,
        publishedAt,
        createdAt: publishedAt,
        images: { create: images },
      },
    });
  }
  console.log(`✔ ${SAMPLES.length} anúncios de EXEMPLO criados (isSample=true) para ${SELLERS.length} vendedores fictícios`);
}
