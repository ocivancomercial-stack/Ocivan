import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { processUploadedImage } from "@/services/images/process";
import { AssistantError, getListingAssistant } from "@/services/ai/listing-assistant";
import { COLORS } from "./constants";

export type ListingSuggestionResult = {
  title?: string;
  description?: string;
  categoryId?: string;
  rootCategoryId?: string;
  brandId?: string;
  color?: string;
  visibleFeatures: string[];
  keywords: string[];
  disclaimers: string[];
};

/** Limites por vendedor (controle de custo da API de IA). */
export const AI_LIMITS = { perHour: 10, perDay: 30 };

/**
 * Gera sugestões a partir de uma foto. Nunca grava nada no anúncio:
 * o vendedor revisa e aplica no formulário.
 */
export async function suggestListingFromPhoto(userId: string, photo: Buffer): Promise<ListingSuggestionResult> {
  const assistant = await getListingAssistant();
  if (!assistant) throw new AssistantError("Assistente de IA desativado.");

  const [hour, day] = await Promise.all([
    rateLimit(`ai:h:${userId}`, { max: AI_LIMITS.perHour, windowSeconds: 3600 }),
    rateLimit(`ai:d:${userId}`, { max: AI_LIMITS.perDay, windowSeconds: 86400 }),
  ]);
  if (!hour.allowed || !day.allowed) throw new AssistantError("Você atingiu o limite de sugestões por enquanto. Tente mais tarde.");

  // Mesmo pipeline de validação das fotos do anúncio; imagem menor = menos tokens.
  const image = await processUploadedImage(photo, { maxSide: 1024 });

  const [subcategories, brands] = await Promise.all([
    prisma.category.findMany({ where: { active: true, parentId: { not: null }, parent: { active: true } }, select: { id: true, slug: true, parentId: true } }),
    prisma.brand.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);

  const s = await assistant.suggest(
    { data: image.data, contentType: image.contentType },
    { categories: subcategories.map((c) => c.slug), brands: brands.map((b) => b.name), colors: COLORS },
  );
  const category = subcategories.find((c) => c.slug === s.categorySlug);
  const brand = brands.find((b) => b.name === s.brandName);
  return {
    title: s.title,
    description: s.description,
    categoryId: category?.id,
    rootCategoryId: category?.parentId ?? undefined,
    brandId: brand?.id,
    color: s.color,
    visibleFeatures: s.visibleFeatures,
    keywords: s.keywords,
    disclaimers: s.disclaimers,
  };
}
