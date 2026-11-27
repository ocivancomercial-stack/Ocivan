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

export type SuggestionContext = { categories: string[]; brands: string[]; colors: string[] };

export interface ListingAssistant {
  readonly name: string;
  suggest(image: { data: Buffer; contentType: "image/webp" }, context: SuggestionContext): Promise<ListingSuggestion>;
}

/** Erro com mensagem segura para exibir ao vendedor. */
export class AssistantError extends Error {}

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

let assistant: ListingAssistant | null | undefined;

/** Retorna o assistente configurado ou null (IA desligada: AI_PROVIDER vazio). */
export async function getListingAssistant(): Promise<ListingAssistant | null> {
  if (assistant !== undefined) return assistant;
  switch (process.env.AI_PROVIDER) {
    case undefined:
    case "":
      assistant = null;
      break;
    case "anthropic": {
      if (!isListingAssistantEnabled()) {
        assistant = null;
        break;
      }
      const { AnthropicListingAssistant } = await import("./anthropic-assistant");
      assistant = new AnthropicListingAssistant();
      break;
    }
    default:
      throw new Error(`AI_PROVIDER "${process.env.AI_PROVIDER}" não suportado`);
  }
  return assistant;
}

export function setListingAssistant(a: ListingAssistant | null) {
  assistant = a;
}

/** Ligado apenas com provedor escolhido E credencial presente (sem chave, o botão nem aparece). */
export function isListingAssistantEnabled() {
  if (process.env.AI_PROVIDER === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
  return false;
}
