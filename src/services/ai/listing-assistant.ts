/**
 * Assistente de anúncio por IA — arquitetura desacoplada.
 *
 * Regras para qualquer implementação:
 *  - Sugere apenas o que é VISÍVEL na foto. Marca só quando o logotipo é legível.
 *  - NUNCA afirma autenticidade, tamanho ou estado de conservação.
 *  - Toda sugestão é revisada e aprovada pelo vendedor antes de ir para o anúncio.
 *  - O marketplace funciona normalmente sem IA (AI_PROVIDER vazio).
 */
export type ListingSuggestion = {
  title?: string;
  description?: string;
  categorySlug?: string; // sempre uma das subcategorias existentes
  brandName?: string; // apenas se legível na imagem
  color?: string;
  visibleFeatures: string[];
  keywords: string[];
  /** Avisos fixos exibidos ao vendedor junto com as sugestões. */
  disclaimers: string[];
};

export interface ListingAssistant {
  readonly name: string;
  suggest(image: { data: Buffer; contentType: string }, context: { categories: string[]; brands: string[]; colors: string[] }): Promise<ListingSuggestion>;
}

export const SUGGESTION_DISCLAIMERS = [
  "Sugestões automáticas: revise tudo antes de publicar.",
  "A IA não verifica autenticidade, tamanho nem estado de conservação — informe você mesmo.",
];

/** Sanitiza a resposta de qualquer provedor contra as listas permitidas (defesa contra alucinação). */
export function sanitizeSuggestion(
  s: Partial<ListingSuggestion>,
  allowed: { categories: string[]; brands: string[]; colors: string[] },
): ListingSuggestion {
  const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : undefined);
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 40)).slice(0, 10) : []);
  return {
    title: clip(s.title, 80),
    description: clip(s.description, 1000),
    categorySlug: allowed.categories.includes(s.categorySlug ?? "") ? s.categorySlug : undefined,
    brandName: allowed.brands.find((b) => b.toLowerCase() === s.brandName?.toLowerCase()),
    color: allowed.colors.includes(s.color ?? "") ? s.color : undefined,
    visibleFeatures: list(s.visibleFeatures),
    keywords: list(s.keywords),
    disclaimers: SUGGESTION_DISCLAIMERS,
  };
}

/**
 * Retorna o assistente configurado ou null (IA desligada).
 * Nenhum provedor real está implementado nesta etapa: a escolha do fornecedor e o custo
 * por chamada dependem de aprovação (ver docs/ROADMAP.md).
 */
export function getListingAssistant(): ListingAssistant | null {
  switch (process.env.AI_PROVIDER) {
    case undefined:
    case "":
      return null;
    default:
      throw new Error(`AI_PROVIDER "${process.env.AI_PROVIDER}" não implementado`);
  }
}

export function isListingAssistantEnabled() {
  return Boolean(process.env.AI_PROVIDER);
}
